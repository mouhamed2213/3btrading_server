import { badRequest, notFound } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import { deleteImages, uploadImage } from "../../lib/storage.js";

export const MAX_IMAGES_PER_ITEM = 8;

type Owner = { equipmentId: string } | { partId: string };

/** Envoie les fichiers dans Supabase Storage puis enregistre leurs URL. La première photo (position 0) sert de couverture. */
export async function addImages(owner: Owner, files: Express.Multer.File[]) {
  if (files.length === 0)
    throw badRequest("Aucune photo reçue (champ « images »)");
  const existing = await prisma.image.count({ where: owner });
  if (existing + files.length > MAX_IMAGES_PER_ITEM) {
    throw badRequest(
      `Maximum ${MAX_IMAGES_PER_ITEM} photos par élément (${existing} déjà enregistrées)`,
    );
  }
  const folder =
    "equipmentId" in owner
      ? `equipment/${owner.equipmentId}`
      : `parts/${owner.partId}`;
  const uploaded = await Promise.all(files.map((f) => uploadImage(f, folder)));
  try {
    await prisma.image.createMany({
      data: uploaded.map((u, i) => ({
        url: u.url,
        storagePath: u.path,
        position: existing + i,
        ...owner,
      })),
    });
  } catch (err) {
    await deleteImages(uploaded.map((u) => u.path)).catch((e) =>
      logger.warn({ e }, "Nettoyage storage impossible"),
    );
    throw err;
  }
  return prisma.image.findMany({ where: owner, orderBy: { position: "asc" } });
}

export async function removeImage(id: string) {
  const image = await prisma.image.findUnique({ where: { id } });
  if (!image) throw notFound("Photo");
  await prisma.image.delete({ where: { id } });
  if (image.storagePath) {
    await deleteImages([image.storagePath]).catch((e) =>
      logger.warn({ e, id }, "Fichier storage non supprimé"),
    );
  }
}

/** À appeler après suppression d'un engin / d'une pièce pour nettoyer les fichiers orphelins. */
export async function cleanupFiles(paths: (string | null)[]) {
  await deleteImages(paths.filter((p): p is string => !!p)).catch((e) =>
    logger.warn({ e }, "Nettoyage storage impossible"),
  );
}
