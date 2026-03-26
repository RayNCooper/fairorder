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
  Link,
  Row,
  Column,
} from "@react-email/components";

interface OrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

interface OrderConfirmationEmailProps {
  orderNumber: number;
  customerName: string;
  locationName: string;
  items: OrderItem[];
  total: number;
  pickupTime: Date;
  orderPageUrl: string;
  baseUrl?: string;
}

function formatPrice(amount: number): string {
  return amount.toFixed(2).replace(".", ",");
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  });
}

export default function OrderConfirmationEmail({
  orderNumber,
  customerName,
  locationName,
  items,
  total,
  pickupTime,
  orderPageUrl,
  baseUrl = "https://app.fair-order.de",
}: OrderConfirmationEmailProps) {
  return (
    <Html lang="de">
      <Head />
      <Preview>{`Bestellung #${orderNumber} bei ${locationName} aufgegeben`}</Preview>
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
            Bestellung aufgegeben
          </Heading>

          <Text style={text}>
            Hey {customerName}, deine Bestellung{" "}
            <strong>#{orderNumber}</strong> bei{" "}
            <strong>{locationName}</strong> wurde aufgenommen.
          </Text>

          <Section style={badgeSection}>
            <Text style={badge}>
              Abholung: {formatTime(pickupTime)} Uhr
            </Text>
          </Section>

          <Section style={itemsSection}>
            {items.map((item, i) => (
              <Row key={i} style={itemRow}>
                <Column style={itemQty}>
                  <Text style={itemText}>{item.quantity}x</Text>
                </Column>
                <Column style={itemName}>
                  <Text style={itemText}>{item.name}</Text>
                </Column>
                <Column style={itemPrice}>
                  <Text style={itemTextRight}>
                    {formatPrice(item.unitPrice * item.quantity)}&nbsp;&euro;
                  </Text>
                </Column>
              </Row>
            ))}
          </Section>

          <Hr style={itemDivider} />

          <Row style={totalRow}>
            <Column style={itemName}>
              <Text style={totalLabel}>Gesamt</Text>
            </Column>
            <Column style={itemPrice}>
              <Text style={totalValue}>{formatPrice(total)}&nbsp;&euro;</Text>
            </Column>
          </Row>

          <Section style={ctaSection}>
            <Link href={orderPageUrl} style={ctaLink}>
              Bestellung verfolgen
            </Link>
          </Section>

          <Hr style={divider} />

          <Text style={footnote}>
            Du kannst den Status deiner Bestellung jederzeit unter dem Link oben
            verfolgen. Wir benachrichtigen dich, wenn sie abholbereit ist.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

OrderConfirmationEmail.PreviewProps = {
  orderNumber: 42,
  customerName: "Max",
  locationName: "Mensa Uni Mainz",
  items: [
    { name: "Schnitzel mit Pommes", quantity: 2, unitPrice: 7.0 },
    { name: "Apfelschorle", quantity: 1, unitPrice: 2.5 },
  ],
  total: 16.5,
  pickupTime: new Date("2026-03-26T12:30:00"),
  orderPageUrl: "https://app.fair-order.de/order/k7Hx9mPq2vNr",
  baseUrl: "https://app.fair-order.de",
} satisfies OrderConfirmationEmailProps;

// -- Styles --

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
  backgroundColor: "#F59E0B",
  color: "#FFFFFF",
  padding: "12px 32px",
  fontWeight: 600,
  fontSize: "14px",
  fontFamily: "'JetBrains Mono', monospace",
  margin: "0",
};

const itemsSection: React.CSSProperties = {
  margin: "0 0 8px",
};

const itemRow: React.CSSProperties = {
  margin: "0",
};

const itemQty: React.CSSProperties = {
  width: "40px",
  verticalAlign: "top",
};

const itemName: React.CSSProperties = {
  verticalAlign: "top",
};

const itemPrice: React.CSSProperties = {
  width: "80px",
  textAlign: "right" as const,
  verticalAlign: "top",
};

const itemText: React.CSSProperties = {
  margin: "0 0 4px",
  fontSize: "14px",
  color: "#1C1917",
  fontFamily: "'JetBrains Mono', monospace",
  lineHeight: "1.6",
};

const itemTextRight: React.CSSProperties = {
  ...itemText,
  textAlign: "right" as const,
};

const itemDivider: React.CSSProperties = {
  borderColor: "#E7E5E4",
  margin: "8px 0",
};

const totalRow: React.CSSProperties = {
  margin: "0 0 24px",
};

const totalLabel: React.CSSProperties = {
  margin: "0",
  fontSize: "14px",
  fontWeight: 800,
  color: "#1C1917",
};

const totalValue: React.CSSProperties = {
  margin: "0",
  fontSize: "14px",
  fontWeight: 800,
  color: "#1C1917",
  textAlign: "right" as const,
  fontFamily: "'JetBrains Mono', monospace",
};

const ctaSection: React.CSSProperties = {
  margin: "0 0 24px",
  textAlign: "center" as const,
};

const ctaLink: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#16A34A",
  color: "#FFFFFF",
  padding: "12px 32px",
  fontWeight: 600,
  fontSize: "14px",
  textDecoration: "none",
};

const footnote: React.CSSProperties = {
  color: "#78716C",
  fontSize: "13px",
  margin: "0",
  lineHeight: "1.5",
};
