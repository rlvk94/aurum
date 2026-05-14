import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type Row = { label: string; value: string };

type Props = {
  preview: string;
  heading: string;
  rows: Row[];
  footerText: string;
};

export function SignupNotificationEmail({
  preview,
  heading,
  rows,
  footerText,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>{heading}</Heading>
          <Section style={table}>
            {rows.map((row) => (
              <Section key={row.label} style={tableRow}>
                <Text style={tableLabel}>{row.label}</Text>
                <Text style={tableValue}>{row.value}</Text>
              </Section>
            ))}
          </Section>
          <Hr style={hr} />
          <Text style={footer}>{footerText}</Text>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: "#fafafa",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  margin: "40px auto",
  maxWidth: "560px",
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "32px",
};

const h1: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 600,
  color: "#111827",
  margin: "0 0 24px",
};

const table: React.CSSProperties = {
  margin: "0 0 8px",
};

const tableRow: React.CSSProperties = {
  borderBottom: "1px solid #f3f4f6",
  padding: "8px 0",
};

const tableLabel: React.CSSProperties = {
  fontSize: "12px",
  color: "#6b7280",
  margin: "0 0 2px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const tableValue: React.CSSProperties = {
  fontSize: "14px",
  color: "#111827",
  margin: 0,
};

const hr: React.CSSProperties = {
  borderColor: "#e5e7eb",
  margin: "24px 0 16px",
};

const footer: React.CSSProperties = {
  fontSize: "11px",
  color: "#9ca3af",
  margin: 0,
};
