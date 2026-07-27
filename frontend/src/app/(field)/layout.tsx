import { FieldShell } from "@/components/field/FieldShell";

export default function FieldLayout({ children }: { children: React.ReactNode }) {
  return <FieldShell>{children}</FieldShell>;
}
