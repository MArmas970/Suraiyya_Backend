import express from "express";
import {
  createPet,
  getPet,
  updatePet,
  deletePet
} from "../controllers/petController.js";

const router = express.Router();



router.post("/", createPet);

router.get("/:id", getPet);


router.put("/:id", updatePet);

router.delete("/:id", deletePet);


export default router;
