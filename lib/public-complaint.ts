import type { Complaint, ComplaintStatus, Outcome } from "@/lib/types";

/**
 * What /resolve and the public status endpoint are allowed to see.
 *
 * Deliberately omits the resident's mobile number. The technician is standing
 * at the door, and a token that leaks should not hand out a phone number with
 * it. The dashboard, which is behind a login, shows the full record.
 *
 * Shared by the API route and the server-rendered /resolve page so the two
 * cannot drift apart and start disagreeing about what is public.
 */
export type PublicComplaint = {
  token: string;
  submitted_at: string;
  complaint_date: string;
  resident_name: string;
  quarter_no: string;
  issue_type_en: string;
  issue_type_hi: string;
  description: string;
  photo_url: string | null;
  status: ComplaintStatus;
  overdue: boolean;
  age_hours: number;
  visits: {
    resolved_at: string;
    technician_name: string;
    outcome: Outcome;
    action_taken: string;
  }[];
};

export function toPublicComplaint(c: Complaint): PublicComplaint {
  return {
    token: c.token,
    submitted_at: c.submitted_at,
    complaint_date: c.complaint_date,
    resident_name: c.resident_name,
    quarter_no: c.quarter_no,
    issue_type_en: c.issue_type_en,
    issue_type_hi: c.issue_type_hi,
    description: c.description,
    photo_url: c.photo_url,
    status: c.status,
    overdue: c.overdue,
    age_hours: c.age_hours,
    visits: c.visits.map((v) => ({
      resolved_at: v.resolved_at,
      technician_name: v.technician_name,
      outcome: v.outcome,
      action_taken: v.action_taken,
    })),
  };
}
