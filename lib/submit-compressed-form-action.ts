import { startTransition } from "react";
import {
  compressFormDataImages,
  formDataHasLargeImages,
} from "@/lib/odometer-image-compress.client";

/** Compress odometer photos, then dispatch the server action inside a React transition. */
export async function submitCompressedFormAction(
  formData: FormData,
  formAction: (data: FormData) => void,
) {
  if (formDataHasLargeImages(formData)) {
    await compressFormDataImages(formData);
  }
  startTransition(() => {
    formAction(formData);
  });
}
