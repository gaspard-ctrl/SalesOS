// Vidéo avatar HeyGen (table autonome `video_jobs`). Pas forcément liée à un
// client : client_id/client_name ne sont remplis que quand Claude a rattaché la
// demande à un client existant (tool get_client_context) ou via un lien direct
// depuis la fiche client (?clientId=...).

export type VideoJobStatus = "processing" | "completed" | "failed";

export type VideoJob = {
  id: string;
  client_id: string | null;
  client_name: string | null;
  prompt: string;
  script: string;
  heygen_video_id: string;
  status: VideoJobStatus;
  video_url: string | null;
  error: string | null;
  created_by: string | null;
  created_at: string;
};
