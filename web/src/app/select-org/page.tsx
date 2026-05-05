import { OrganizationList } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <OrganizationList
        hidePersonal
        afterSelectOrganizationUrl="/"
        afterCreateOrganizationUrl="/"
      />
    </main>
  );
}
