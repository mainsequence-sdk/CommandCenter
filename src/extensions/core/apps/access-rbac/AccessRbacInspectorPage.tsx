import { useAccessRbacData, AccessRbacSurfaceLayout, UserAccessInspectorPanel } from "./shared";

export function AccessRbacInspectorPage() {
  const { sessionUser } = useAccessRbacData();

  return (
    <AccessRbacSurfaceLayout
      title="User access inspector"
      description="Search the user directory and inspect how one specific user resolves through roles, permissions, and effective shell access."
    >
      <div className="max-w-6xl">
        <UserAccessInspectorPanel sessionUser={sessionUser} />
      </div>
    </AccessRbacSurfaceLayout>
  );
}
