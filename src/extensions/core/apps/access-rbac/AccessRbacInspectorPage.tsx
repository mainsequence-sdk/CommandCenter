import { useAccessRbacData, AccessRbacSurfaceLayout, UserAccessInspectorPanel } from "./shared";

export function AccessRbacInspectorPage() {
  const { sessionUser } = useAccessRbacData();

  return (
    <AccessRbacSurfaceLayout
      title="User access inspector"
      description="Search the user directory and inspect resolved Command Center shell access for one user."
    >
      <div className="w-full">
        <UserAccessInspectorPanel sessionUser={sessionUser} />
      </div>
    </AccessRbacSurfaceLayout>
  );
}
