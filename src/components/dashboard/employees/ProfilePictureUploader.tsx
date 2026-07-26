"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Avatar, Box, CircularProgress, IconButton, Tooltip } from "@mui/material";
import { CameraAltRounded } from "@mui/icons-material";
import { useMutation } from "@apollo/client/react";
import { UploadProfilePictureDocument } from "@/graphql/generated";
import toast from "react-hot-toast";

type ProfilePictureUploaderProps = {
  currentUrl?: string | null;
  fallbackText: string;
  size?: number;
  onUploaded?: (url: string) => void;
};

const readAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      // FileReader.readAsDataURL prefixes "data:<mime>;base64,", the mutation
      // only wants the raw base64 payload.
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Unable to read the selected file."));
    reader.readAsDataURL(file);
  });

export function ProfilePictureUploader({
  currentUrl,
  fallbackText,
  size = 64,
  onUploaded,
}: ProfilePictureUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [uploadProfilePicture, { loading }] = useMutation(UploadProfilePictureDocument, {
    // Refetches everywhere this user's photo could already be rendered
    // (topbar, my-profile page), since the mutation result (type User) and
    // those queries' UserInfo/Employee objects don't share a cache key.
    refetchQueries: ["Me", "GetMyEmployeeProfile"],
    onCompleted: (data) => {
      const url = data.uploadProfilePicture.profilePicture;
      if (url) {
        setPreviewUrl(url);
        onUploaded?.(url);
        toast.success("Profile picture updated.");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to upload profile picture.");
    },
  });

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const fileDataBase64 = await readAsBase64(file);
      await uploadProfilePicture({ variables: { fileDataBase64, fileName: file.name } });
    } catch {
      toast.error("Unable to read the selected file.");
    }
  };

  const src = previewUrl ?? currentUrl ?? undefined;

  return (
    <Box sx={{ position: "relative", width: size, height: size }}>
      <Avatar src={src} sx={{ width: size, height: size, bgcolor: "primary.main" }}>
        {!src ? fallbackText.charAt(0) || "?" : null}
      </Avatar>

      {loading ? (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            bgcolor: "rgba(15, 23, 42, 0.45)",
            borderRadius: "50%",
          }}
        >
          <CircularProgress size={size * 0.4} sx={{ color: "#fff" }} />
        </Box>
      ) : (
        <Tooltip title="Change photo">
          <IconButton
            size="small"
            onClick={() => fileInputRef.current?.click()}
            sx={{
              position: "absolute",
              bottom: -4,
              right: -4,
              width: 26,
              height: 26,
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              "&:hover": { bgcolor: "background.paper" },
            }}
          >
            <CameraAltRounded sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleFileChange}
      />
    </Box>
  );
}
