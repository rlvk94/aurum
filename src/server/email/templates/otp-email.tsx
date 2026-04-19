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

type Props = {
  preview: string;
  heading: string;
  intro: string;
  codeLabel: string;
  code: string;
  footnote?: string;
  footerText: string;
};

export function OtpEmail({
  preview,
  heading,
  intro,
  codeLabel,
  code,
  footnote,
  footerText,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>{heading}</Heading>
          <Text style={paragraph}>{intro}</Text>
          <Section style={codeBox}>
            <Text style={codeLabelStyle}>{codeLabel}</Text>
            <Text style={codeText}>{code}</Text>
          </Section>
          {footnote ? <Text style={paragraphMuted}>{footnote}</Text> : null}
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
  margin: "0 0 16px",
};

const paragraph: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#374151",
  margin: "0 0 16px",
};

const paragraphMuted: React.CSSProperties = {
  fontSize: "12px",
  lineHeight: "18px",
  color: "#6b7280",
  margin: "24px 0 0",
};

const codeBox: React.CSSProperties = {
  margin: "24px 0",
  padding: "20px",
  backgroundColor: "#fbf6ea",
  border: "1px solid #f0e0b5",
  borderRadius: "6px",
  textAlign: "center",
};

const codeLabelStyle: React.CSSProperties = {
  fontSize: "11px",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#8a6d1f",
  margin: "0 0 8px",
};

const codeText: React.CSSProperties = {
  fontSize: "32px",
  fontWeight: 700,
  letterSpacing: "0.2em",
  color: "#111827",
  margin: 0,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

const hr: React.CSSProperties = {
  borderColor: "#e5e7eb",
  margin: "32px 0 16px",
};

const footer: React.CSSProperties = {
  fontSize: "11px",
  color: "#9ca3af",
  margin: 0,
};
