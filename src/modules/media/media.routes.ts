import { Router } from "express";
import { idParam } from "../../lib/http.js";
import { removeImage } from "./images.service.js";

export const mediaRouter = Router();

mediaRouter.delete("/:id", async (req, res) => {
  await removeImage(idParam.parse(req.params).id);
  res.status(204).end();
});
