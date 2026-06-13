export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background relative flex min-h-screen flex-col overflow-hidden">
      {/* Subtle gold radial glow — top right */}
      <div
        className="pointer-events-none absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full opacity-[0.07]"
        style={{
          background:
            "radial-gradient(circle, hsl(38 60% 50%) 0%, transparent 70%)",
        }}
      />
      {/* Secondary glow — bottom left */}
      <div
        className="pointer-events-none absolute -bottom-48 -left-48 h-[600px] w-[600px] rounded-full opacity-[0.05]"
        style={{
          background:
            "radial-gradient(circle, hsl(38 60% 50%) 0%, transparent 70%)",
        }}
      />
      {children}
    </div>
  );
}
