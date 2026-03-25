import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Section,
  Img,
  Hr,
} from "@react-email/components";

interface MagicLinkEmailProps {
  magicLink: string;
  baseUrl?: string;
}

export default function MagicLinkEmail({
  magicLink,
  baseUrl = "https://app.fair-order.de",
}: MagicLinkEmailProps) {
  return (
    <Html lang="de">
      <Head />
      <Preview>Dein Login-Link für FairOrder</Preview>
      <Body style={bodyStyle}>
        <Container style={container}>
          <Section style={logoSection}>
            <Img
              src={`${baseUrl}/images/logo.png`}
              alt="FairOrder"
              width="150"
              height="80"
              style={logo}
            />
          </Section>

          <Hr style={divider} />

          <Heading as="h2" style={heading}>
            Dein Login-Link
          </Heading>

          <Text style={text}>
            Klicke auf den Button, um dich einzuloggen:
          </Text>

          <Section style={buttonSection}>
            <Button href={magicLink} style={button}>
              Einloggen
            </Button>
          </Section>

          <Text style={footnote}>
            Dieser Link ist 15 Minuten gültig. Falls du diese E-Mail nicht
            angefordert hast, kannst du sie ignorieren.
          </Text>

          <Hr style={divider} />

          <Text style={linkText}>{magicLink}</Text>
        </Container>
      </Body>
    </Html>
  );
}

MagicLinkEmail.PreviewProps = {
  magicLink: "https://app.fair-order.de/verify-email?token=abc123",
  baseUrl: "https://app.fair-order.de",
} satisfies MagicLinkEmailProps;

// ── Styles ──

const bodyStyle: React.CSSProperties = {
  backgroundColor: "#FAFAF8",
  fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
};

const container: React.CSSProperties = {
  maxWidth: "480px",
  margin: "0 auto",
  padding: "40px 24px",
};

const logoSection: React.CSSProperties = {
  padding: "0 0 16px",
};

const logo: React.CSSProperties = {
  display: "block",
};

const divider: React.CSSProperties = {
  borderColor: "#E7E5E4",
  margin: "0 0 24px",
};

const heading: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 800,
  margin: "0 0 16px",
  color: "#1C1917",
};

const text: React.CSSProperties = {
  margin: "0 0 24px",
  fontSize: "14px",
  color: "#1C1917",
  lineHeight: "1.6",
};

const buttonSection: React.CSSProperties = {
  margin: "0 0 32px",
};

const button: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#16A34A",
  color: "#FFFFFF",
  padding: "12px 32px",
  textDecoration: "none",
  fontWeight: 600,
  fontSize: "14px",
};

const footnote: React.CSSProperties = {
  color: "#78716C",
  fontSize: "13px",
  margin: "0 0 24px",
  lineHeight: "1.5",
};

const linkText: React.CSSProperties = {
  color: "#A8A29E",
  fontSize: "11px",
  fontFamily: "'JetBrains Mono', monospace",
  margin: "0",
  wordBreak: "break-all",
};
