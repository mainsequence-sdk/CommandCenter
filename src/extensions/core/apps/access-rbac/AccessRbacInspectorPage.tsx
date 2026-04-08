import { useAccessRbacData, AccessRbacSurfaceLayout, UserAccessInspectorPanel } from "./shared";

export function AccessRbacInspectorPage() {
  const { sessionUser } = useAccessRbacData();

  return (
    <AccessRbacSurfaceLayout
      title="User access inspector"
      description="Search the user directory, assign visible shell policies, apply direct grants or denies, and inspect the resulting effective Command Center access for one user."
    >
      <div className="max-w-6xl">
        <UserAccessInspectorPanel sessionUser={sessionUser} />
      </div>
    </AccessRbacSurfaceLayout>
  );
}
