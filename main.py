from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta, UTC
from transformers import pipeline, AutoModelForCausalLM, AutoTokenizer
import motor.motor_asyncio
from bson import ObjectId
import os
from collections import Counter
import torch
from huggingface_hub import login
login(token=os.getenv("HF_TOKEN"))

app = FastAPI(title="Chatbot & Mood Journal API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017/")
client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URL)
db = client.mood_journal
entries_collection = db.entries
chat_collection = db.chat_messages

print("Loading emotion classifier")
emotion_classifier = pipeline(
    "text-classification",
    model="j-hartmann/emotion-english-distilroberta-base",
    top_k=None
)
print("Emotion classifier loaded")

print("Loading therapy chatbot")
from peft import AutoPeftModelForCausalLM

adapter_path = "./llama1b-therapy-chatbot/final_model"

print(f"  Loading model with adapter from: {adapter_path}")

chatbot_model = AutoPeftModelForCausalLM.from_pretrained(
    adapter_path,
    device_map={"": 0} if torch.cuda.is_available() else "cpu",
    torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
)

chatbot_tokenizer = AutoTokenizer.from_pretrained(adapter_path)

print("Therapy chatbot loaded")

class ChatMessageStore(BaseModel):
    user_id: str
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))

class ChatMessageResponse(BaseModel):
    id: str
    user_id: str
    role: str
    content: str
    timestamp: datetime

class ConversationHistory(BaseModel):
    messages: List[ChatMessageResponse]
    total_messages: int

class JournalEntry(BaseModel):
    user_id: str = Field(..., description="User identifier")
    content: str = Field(..., min_length=5, description="Journal entry text")
    date: Optional[datetime] = None

class JournalEntryResponse(BaseModel):
    id: str
    user_id: str
    content: str
    date: datetime
    emotion: str
    confidence: float

class MonthlyStats(BaseModel):
    month: str
    total_entries: int
    dominant_emotion: str
    emotion_breakdown: dict
    average_confidence: float
    entries: List[JournalEntryResponse]

class ChatRequest(BaseModel):
    message: str
    user_id: Optional[str] = "anonymous"  # Add this field
    system_prompt: Optional[str] = "You are a helpful productivity assistant for people with autism and ADHD who require help with managing their work. Please be empathetic, supportive, and provide helpful guidance."
    
class ChatResponse(BaseModel):
    response: str
    timestamp: datetime

def chat_message_helper(message) -> dict:
    return {
        "id": str(message["_id"]),
        "user_id": message["user_id"],
        "role": message["role"],
        "content": message["content"],
        "timestamp": message["timestamp"]
    }

def analyze_emotion(text: str) -> dict:
    results = emotion_classifier(text)[0]
    results_sorted = sorted(results, key=lambda x: x['score'], reverse=True)
    top_emotion = results_sorted[0]
    
    return {
        'emotion': top_emotion['label'],
        'confidence': top_emotion['score'],
    }

def entry_helper(entry) -> dict:
    return {
        "id": str(entry["_id"]),
        "user_id": entry["user_id"],
        "content": entry["content"],
        "date": entry["date"],
        "emotion": entry["emotion"],
        "confidence": entry["confidence"],
    }

def generate_chatbot_response(message: str, system_prompt: str, conversation_history: List[dict] = None) -> str:
    
    conversation = f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n{system_prompt}<|eot_id|>"
    
    if conversation_history:
        print(f"  Including {len(conversation_history)} previous messages for context")
        for msg in conversation_history:
            role = msg['role']
            content = msg['content']
            conversation += f"<|start_header_id|>{role}<|end_header_id|>\n\n{content}<|eot_id|>"
    
    conversation += f"<|start_header_id|>user<|end_header_id|>\n\n{message}<|eot_id|>"
    conversation += f"<|start_header_id|>assistant<|end_header_id|>\n\n"
    
    
    print(f"  Tokenizing")
    inputs = chatbot_tokenizer(conversation, return_tensors="pt").to(chatbot_model.device)
    print(f"  Input tokens: {inputs['input_ids'].shape[1]}")
    
    print(f"  Generating (it'll take a while)")
    with torch.no_grad():
        outputs = chatbot_model.generate(
            **inputs,
            max_new_tokens=300,
            min_new_tokens=50,
            temperature=0.7,
            top_p=0.9,
            do_sample=True,
            pad_token_id=chatbot_tokenizer.pad_token_id,
        )
    
    print(f"  Decoding")
    response = chatbot_tokenizer.decode(outputs[0], skip_special_tokens=True)
    
    print(f"  Extracting response")
    if "assistant" in response:
        response = response.split("assistant")[-1].strip()
    
    print(f"  Response length: {len(response)} chars")
    return response

@app.get("/api/chat/{user_id}/history", response_model=ConversationHistory)
async def get_chat_history(user_id: str, limit: int = 100):
    
    messages = []
    async for message in chat_collection.find(
        {"user_id": user_id}
    ).sort("timestamp", 1).limit(limit):  # Sort ascending (oldest first)
        messages.append(chat_message_helper(message))
    
    return ConversationHistory(
        messages=messages,
        total_messages=len(messages)
    )

@app.delete("/api/chat/{user_id}/history")
async def clear_chat_history(user_id: str):
    """
    Clear all chat history for a user
    """
    result = await chat_collection.delete_many({"user_id": user_id})
    return {
        "message": f"Deleted {result.deleted_count} messages",
        "deleted_count": result.deleted_count
    }

@app.delete("/api/chat/message/{message_id}")
async def delete_chat_message(message_id: str):
    """
    Delete a specific message
    """
    try:
        result = await chat_collection.delete_one({"_id": ObjectId(message_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Message not found")
        return {"message": "Message deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/chat", response_model=ChatMessageResponse)
async def chat(request: ChatRequest):
    
    print(f"Received chat request from user: {request.user_id}")
    
    try:
        history = []
        async for message in chat_collection.find(
            {"user_id": request.user_id or "anonymous"}
        ).sort("timestamp", -1).limit(6):  # Last 6 messages (3 exchanges)
            history.append(message)
        
        # Reverse to get chronological order (oldest first)
        history.reverse()
        
        # Format history for the model
        conversation_history = [
            {"role": msg["role"], "content": msg["content"]}
            for msg in history
        ]
        
        print(f"  Found {len(conversation_history)} recent messages for context")
        
        # Save user message to database
        user_message_doc = {
            "user_id": request.user_id or "anonymous",
            "role": "user",
            "content": request.message,
            "timestamp": datetime.now(UTC)        }
        await chat_collection.insert_one(user_message_doc)
        print(f"User message saved")
        
        print("Generating response with context...")
        response = generate_chatbot_response(
            request.message, 
            request.system_prompt,
            conversation_history  
        )
        print(f"Response generated: {response[:100]}...")
        
        bot_message_doc = {
            "user_id": request.user_id or "anonymous",
            "role": "assistant",
            "content": response,
            "timestamp": datetime.now(UTC)
        }
        result = await chat_collection.insert_one(bot_message_doc)
        bot_message_doc["_id"] = result.inserted_id
        print(f"Bot message saved")
        
        return chat_message_helper(bot_message_doc)
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.get("/")
async def root():
    return {
        "message": "Chatbot & Mood Journal API",
        "status": "running",
        "endpoints": {
            "chatbot": "/api/chat",
            "mood_journal": "/api/entries"
        }
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "models": {
            "emotion_classifier": "loaded",
            "therapy_chatbot": "loaded"
        }
    }

@app.post("/api/entries", response_model=JournalEntryResponse)
async def create_entry(entry: JournalEntry):
    sentiment = analyze_emotion(entry.content)
    
    entry_dict = {
        "user_id": entry.user_id,
        "content": entry.content,
        "date": entry.date or datetime.utcnow(),
        "emotion": sentiment['emotion'],
        "confidence": sentiment['confidence'],
    }
    
    result = await entries_collection.insert_one(entry_dict)
    entry_dict["_id"] = result.inserted_id
    
    return entry_helper(entry_dict)

@app.get("/api/entries/{user_id}", response_model=List[JournalEntryResponse])
async def get_user_entries(user_id: str, limit: int = 50):
    entries = []
    async for entry in entries_collection.find(
        {"user_id": user_id}
    ).sort("date", -1).limit(limit):
        entries.append(entry_helper(entry))
    
    return entries

@app.get("/api/entries/{user_id}/monthly", response_model=MonthlyStats)
async def get_monthly_stats(user_id: str, year: int, month: int):
    start_date = datetime(year, month, 1)
    if month == 12:
        end_date = datetime(year + 1, 1, 1)
    else:
        end_date = datetime(year, month + 1, 1)
    
    entries = []
    async for entry in entries_collection.find({
        "user_id": user_id,
        "date": {"$gte": start_date, "$lt": end_date}
    }).sort("date", -1):
        entries.append(entry_helper(entry))
    
    if not entries:
        raise HTTPException(status_code=404, detail="No entries found for this month")
    
    emotions = [e['emotion'] for e in entries]
    emotion_counts = Counter(emotions)
    dominant_emotion = emotion_counts.most_common(1)[0][0]
    
    avg_confidence = sum(e['confidence'] for e in entries) / len(entries)
    
    emotion_breakdown = {
        emotion: {
            "count": count,
            "percentage": round(count / len(entries) * 100, 1)
        }
        for emotion, count in emotion_counts.items()
    }
    
    return MonthlyStats(
        month=f"{year}-{month:02d}",
        total_entries=len(entries),
        dominant_emotion=dominant_emotion,
        emotion_breakdown=emotion_breakdown,
        average_confidence=round(avg_confidence, 3),
        entries=entries
    )

@app.get("/api/entries/{user_id}/today", response_model=Optional[JournalEntryResponse])
async def get_today_entry(user_id: str):
    today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    entry = await entries_collection.find_one({
        "user_id": user_id,
        "date": {"$gte": today_start, "$lt": today_end}
    })
    
    if entry:
        return entry_helper(entry)
    return None

@app.delete("/api/entries/{entry_id}")
async def delete_entry(entry_id: str):
    try:
        result = await entries_collection.delete_one({"_id": ObjectId(entry_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Entry not found")
        return {"message": "Entry deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Left unused, the regular chatbot endpoint is used for the mood journal section

@app.post("/api/chat/analyze-entry")
async def chat_about_entry(entry_id: str):
    try:
        entry = await entries_collection.find_one({"_id": ObjectId(entry_id)})
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        analysis_prompt = f"""Based on this journal entry, provide supportive insights and suggestions:

Entry: "{entry['content']}"

Detected emotion: {entry['emotion']} (confidence: {entry['confidence']:.2%})

Please provide:
1. Validation of their feelings
2. Brief insight into this emotional state
3. One coping suggestion"""
        
        response = generate_chatbot_response(
            analysis_prompt,
            "You are a compassionate mental health assistant analyzing journal entries."
        )
        
        return {
            "entry_id": str(entry["_id"]),
            "emotion": entry['emotion'],
            "analysis": response,
            "timestamp": datetime.now(UTC)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)