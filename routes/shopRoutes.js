import express from "express";
import User from "../models/User.js";
import Pet from "../models/Pet.js";

const router = express.Router();

function getPetCost(user) {
  return user.petID ? 250 : 0; // first pet → free
}

function getAccessoryCost() {
  return 100;
}

function getAccessoryNode(filename) {
  if (filename.startsWith("hat_")) return "head";
  if (filename.startsWith("bow_")) return "neck";
  return "tail";
}


router.post("/buy/pet", async (req, res) => {
  try {
    const { userId, petType, baseSprite } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const cost = getPetCost(user);
    console.log("cost: ",cost);

    if (user.currency < cost) {
      return res.status(400).json({ error: "Not enough coins" });
    }

    user.currency -= cost;

    let pet;
    if (!user.petID) {
      // First-time: create a new Pet document
      pet = await Pet.create({
        petType,
        baseSprite,
        equippedAccessories: { head: null, neck: null, tail: null },
        owner: user._id
      });

      user.petID = pet._id;
      user.ownedPets.push(baseSprite);
      await user.save();
    } else {
      pet = await Pet.findByIdAndUpdate(
        user.petID,
        { petType, baseSprite },
        { new: true }
      );
      if (!user.ownedPets.includes(baseSprite)) {
        user.ownedPets.push(baseSprite);
      }
      
      await user.save();
    }

    res.json({
      message: cost === 0 ? "First pet chosen!" : "Pet purchased!",
      pet,
      currency: user.currency,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/equip/pet", async (req, res) => {
  try {
    const { userId, petType, baseSprite } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    let pet;
    if (!user.petID) {
      return res.json({
      message: "User doesn't have a pet"
    });
    } else {
      pet = await Pet.findByIdAndUpdate(
        user.petID,
        { petType, baseSprite },
        { new: true }
      );
      if (!user.ownedPets.includes(baseSprite)) {
        user.ownedPets.push(baseSprite);
      }
      await user.save();
    }
    console.log("Pet Equipped: ", pet)
    res.json({
      message: "Pet Equipped!",
      pet
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/buy/accessory", async (req, res) => {
  try {
    const { userId, accessory } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const pet = await Pet.findById(user.petID);
    if (!pet) return res.status(404).json({ error: "Pet not found" });

    const cost = getAccessoryCost();

    const category = getAccessoryNode(accessory);

    // Check if already owned
    if (pet.ownedAccessories[category].includes(accessory)) {
      return res.status(400).json({ error: "You already own this accessory" });
    }

    // Check money
    if (user.currency < cost) {
      return res.status(400).json({ error: "Not enough coins" });
    }

    // Deduct cost
    user.currency -= cost;

    // Add to owned array
    pet.ownedAccessories[category].push(accessory);

    await user.save();
    await pet.save();

    res.json({
      message: "Accessory purchased!",
      accessory,
      currency: user.currency,
      pet
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


router.post("/equip/accessory/:petId", async (req, res) => {
  try {
    const { userId, accessory } = req.body;
    const { petId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const pet = await Pet.findById(petId);
    if (!pet) return res.status(404).json({ error: "Pet not found" });

    const category = getAccessoryNode(accessory);

    if (!pet.ownedAccessories[category].includes(accessory)) {
      return res.status(400).json({ error: "Accessory not owned" });
    }

    if (!category) {
      return res.status(400).json({ error: "Invalid accessory format" });
    }

    if (!Array.isArray(pet.equippedAccessories[category])) {
      pet.equippedAccessories[category] = [];
    }

    // Push into array
    pet.equippedAccessories[category].push(accessory);
    await pet.save();

    res.json({ message: "Equipped!", pet });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/unequip/accessory/:petId", async (req, res) => {
  try {
    const { accessory } = req.body;
    const { petId } = req.params;

    const pet = await Pet.findById(petId);
    if (!pet) return res.status(404).json({ error: "Pet not found" });

    const category = getAccessoryNode(accessory);

    if (!pet.ownedAccessories[category].includes(accessory)) {
      return res.status(400).json({ error: "Accessory not owned" });
    }

    if (!category) {
      return res.status(400).json({ error: "Invalid accessory format" });
    }

    // only remove if currently equipped
    if (!pet.equippedAccessories[category].includes(accessory)) {
      return res.status(400).json({ error: "Accessory not currently equipped" });
    }

    pet.equippedAccessories[category] = [];
    await pet.save();

    res.json({ message: "Unequipped!", pet });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/status/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).populate("petId");
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      currency: user.currency,
      ownedAccessories: user.ownedAccessories,
      petId: user.petId?._id || null,
      equipped: user.petId?.equippedAccessories || {},
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
