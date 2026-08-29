import type { NoticeExtraction } from "@/lib/domain/notice-extractor";

export type NoticeStatus = "uploaded" | "extracting" | "needs_ocr" | "needs_review" | "validated" | "rejected" | "failed";

export type NoticeSubmission = {
  id: string;
  original_filename: string;
  file_size: number;
  page_count: number | null;
  structured_data: NoticeExtraction | Record<string, never>;
  extraction_confidence: number | null;
  status: NoticeStatus;
  processing_error: string | null;
  reviewer_notes: string | null;
  created_at: string;
  updated_at: string;
};
