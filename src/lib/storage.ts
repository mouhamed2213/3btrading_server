import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { AppError } from "./errors.js";

let client: S3Client | undefined;

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function getStorage() {
  const {
    S3_ENDPOINT,
    S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY,
    SEAWEEDFS_BUCKET,
    // SEAWEEDFS_PUBLIC_URL,
  } = env;

  if (
    !S3_ENDPOINT ||
    !S3_ACCESS_KEY_ID ||
    !S3_SECRET_ACCESS_KEY ||
    !SEAWEEDFS_BUCKET
    // !SEAWEEDFS_PUBLIC_URL
  ) {
    throw new AppError(
      503,
      "Stockage SeaweedFS non configure",
      "STORAGE_DISABLED",
    );
  }

  client ??= new S3Client({
    endpoint: S3_ENDPOINT,
    region: "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
  });

  return {
    client,
    bucket: SEAWEEDFS_BUCKET,
    // publicUrl: SEAWEEDFS_PUBLIC_URL.replace(/\/+$/, ""),
  };
}

/**
 * Envoie une photo dans SeaweedFS et renvoie son chemin
 * ainsi que son URL d'acces.
 */
export async function uploadImage(file: Express.Multer.File, folder: string) {
  const extension = EXT[file.mimetype];

  if (!extension) {
    throw new AppError(
      415,
      "Format de photo non pris en charge",
      "INVALID_IMAGE_TYPE",
    );
  }

  // const { client, bucket, publicUrl } = getStorage();
  const { client, bucket } = getStorage();

  const safeFolder = folder
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");

  const path = `${safeFolder}/${randomUUID()}.${extension}`;

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: path,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  } catch {
    throw new AppError(
      502,
      "Echec de l'envoi de la photo vers SeaweedFS",
      "STORAGE_ERROR",
    );
  }

  // Fonctionne si l'endpoint expose les objets en lecture publique
  // sous la forme /<bucket>/<path>.
  // const url = `${publicUrl}/${bucket}/${path
  //   .split("/")
  //   .map(encodeURIComponent)
  //   .join("/")}`;

  // return { path, url };
  return { path };
}

/**
 * Supprime des photos de SeaweedFS a partir de leurs chemins.
 */
export async function deleteImages(paths: string[]) {
  if (paths.length === 0) return;

  const { client, bucket } = getStorage();

  try {
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: paths.map((path) => ({ Key: path })),
          Quiet: true,
        },
      }),
    );
  } catch {
    throw new AppError(
      502,
      "Echec de la suppression des photos dans SeaweedFS",
      "STORAGE_ERROR",
    );
  }
}

// import { createClient, type SupabaseClient } from "@supabase/supabase-js";
// import { randomUUID } from "node:crypto";
// import { env } from "../config/env.js";
// import { AppError } from "./errors.js";

// let client: SupabaseClient | undefined;

// function bucket() {
//   if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
//     throw new AppError(
//       503,
//       "Stockage des photos non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)",
//       "STORAGE_DISABLED",
//     );
//   }
//   client ??= createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
//     auth: { persistSession: false },
//   });
//   return client.storage.from(env.SUPABASE_BUCKET);
// }

// const EXT: Record<string, string> = {
//   "image/jpeg": "jpg",
//   "image/png": "png",
//   "image/webp": "webp",
// };

// /** Envoie une photo dans le bucket public et renvoie son chemin + son URL publique. */
// export async function uploadImage(file: Express.Multer.File, folder: string) {
//   const path = `${folder}/${randomUUID()}.${EXT[file.mimetype] ?? "jpg"}`;
//   const store = bucket();
//   const { error } = await store.upload(path, file.buffer, {
//     contentType: file.mimetype,
//     cacheControl: "31536000",
//   });
//   if (error)
//     throw new AppError(
//       502,
//       `Échec de l'envoi de la photo : ${error.message}`,
//       "STORAGE_ERROR",
//     );
//   return { path, url: store.getPublicUrl(path).data.publicUrl };
// }

// export async function deleteImages(paths: string[]) {
//   if (paths.length === 0) return;
//   const { error } = await bucket().remove(paths);
//   if (error)
//     throw new AppError(
//       502,
//       `Échec de la suppression de la photo : ${error.message}`,
//       "STORAGE_ERROR",
//     );
// }
