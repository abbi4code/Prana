"use client";

import { useParams } from "next/navigation";
import { AdminGate } from "@/components/admin/AdminGate";
import { UserDetail } from "@/components/admin/UserDetail";

/** One member, everything they logged (D51). Opening it is written to the admin access log. */
export default function AdminUserPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <AdminGate>
      <UserDetail key={id} id={id} />
    </AdminGate>
  );
}
