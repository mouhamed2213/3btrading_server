import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.js";
import { AppError } from "./errors.js";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Configuration (si ce n'est pas fait ailleurs)
cloudinary.config({
  cloud_name: env.CLOUDINARY_NAME,
  api_key: env.CLOUDINARY_API,
  api_secret: env.CLOUDINARY_SECRETE_KEY,
});

/**
 * Envoie une photo dans Cloudinary et renvoie son chemin
 * ainsi que son URL d'accès.
 */
export async function uploadImage(file: Express.Multer.File, folder?: string) {
  const extension = EXT[file.mimetype];

  if (!extension) {
    throw new AppError(
      415,
      "Format de photo non pris en charge",
      "INVALID_IMAGE_TYPE",
    );
  }

  let uploadResult: any;

  try {
    // Utilisation de upload_stream pour gérer le Buffer de Multer
    uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: folder || "3bTrading", // Dossier optionnel dans Cloudinary
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );

      stream.end(file.buffer);
    });
  } catch (error) {
    throw new AppError(
      502,
      "Echec de l'insertion de la photo",
      "STORAGE_ERROR",
    );
  }

  // Génération de l'URL transformée/optimisée en utilisant le public_id
  const imageUrl = cloudinary.url(uploadResult.public_id, {
    fetch_format: "auto",
    quality: "auto",
    crop: "fill",
    gravity: "auto",
    // width: 500,
    // height: 500,
    height: 560,
  });

  return {
    path: uploadResult.public_id, // L'identifiant unique utile pour supprimer/gérer l'image
    url: imageUrl, // L'URL finale optimisée et redimensionnée en 500x500
  };
}
/**
 */
export async function deleteImages(paths: string[]) {
  // if (paths.length === 0) return;
  // const { client, bucket } = getStorage();
  // try {
  //   await client.send(
  //     new DeleteObjectsCommand({
  //       Bucket: bucket,
  //       Delete: {
  //         Objects: paths.map((path) => ({ Key: path })),
  //         Quiet: true,
  //       },
  //     }),
  //   );
  // } catch {
  //   throw new AppError(
  //     502,
  //     "Echec de la suppression des photos dans SeaweedFS",
  //     "STORAGE_ERROR",
  //   );
  // }
}
