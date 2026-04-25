import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";

type Props = {
  preview: string;
  heading: string;
  intro: string;
  body?: string;
  cta?: string;
  ctaUrl?: string;
  footnote?: string;
  footerText: string;
};

export function BillingEventEmail({
  preview,
  heading,
  intro,
  body: bodyText,
  cta,
  ctaUrl,
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
          {bodyText ? <Text style={paragraph}>{bodyText}</Text> : null}
          {cta && ctaUrl ? (
            <Button href={ctaUrl} style={button}>
              {cta}
            </Button>
          ) : null}
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
  margin: "16px 0 0",
};

const button: React.CSSProperties = {
  backgroundColor: "#c89a3c",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 600,
  padding: "12px 24px",
  borderRadius: "6px",
  textDecoration: "none",
  display: "inline-block",
  marginTop: "8px",
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
