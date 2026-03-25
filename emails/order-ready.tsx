import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Text,
  Section,
  Img,
  Hr,
} from "@react-email/components";

interface OrderReadyEmailProps {
  orderNumber: number;
  customerName: string;
  locationName: string;
  baseUrl?: string;
}

export default function OrderReadyEmail({
  orderNumber,
  customerName,
  locationName,
  baseUrl = "https://app.fair-order.de",
}: OrderReadyEmailProps) {
  return (
    <Html lang="de">
      <Head />
      <Preview>{`Deine Bestellung #${orderNumber} ist bereit!`}</Preview>
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
            Bestellung bereit
          </Heading>

          <Text style={text}>
            Hey {customerName}, deine Bestellung{" "}
            <strong>#{orderNumber}</strong> bei{" "}
            <strong>{locationName}</strong> ist fertig und kann abgeholt
            werden.
          </Text>

          <Section style={badgeSection}>
            <Text style={badge}>
              #{orderNumber} — Bereit zur Abholung
            </Text>
          </Section>

          <Hr style={divider} />

          <Text style={footnote}>
            Guten Appetit!
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

OrderReadyEmail.PreviewProps = {
  orderNumber: 42,
  customerName: "Max",
  locationName: "Müllers Bäckerei",
  baseUrl: "https://app.fair-order.de",
} satisfies OrderReadyEmailProps;

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

const badgeSection: React.CSSProperties = {
  margin: "0 0 24px",
};

const badge: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#16A34A",
  color: "#FFFFFF",
  padding: "12px 32px",
  fontWeight: 600,
  fontSize: "14px",
  margin: "0",
};

const footnote: React.CSSProperties = {
  color: "#78716C",
  fontSize: "13px",
  margin: "0",
  lineHeight: "1.5",
};
