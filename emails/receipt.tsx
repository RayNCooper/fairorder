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
  Row,
  Column,
} from "@react-email/components";

interface ReceiptItem {
  quantity: number;
  unitPrice: unknown;
  vatRate: unknown;
  netAmountCents: number;
  vatAmountCents: number;
  menuItem: { name: string; description: string | null };
}

interface ReceiptEmailProps {
  orderNumber: number;
  customerName: string;
  locationName: string;
  companyName: string | null;
  address: string | null;
  vatId: string | null;
  items: ReceiptItem[];
  createdAt: Date;
  paymentMethod: string;
  baseUrl?: string;
}

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " \u20AC";
}

function formatPrice(price: unknown): string {
  return Number(price).toFixed(2).replace(".", ",") + " \u20AC";
}

export default function ReceiptEmail({
  orderNumber,
  customerName,
  locationName,
  companyName,
  address,
  vatId,
  items,
  createdAt,
  paymentMethod,
  baseUrl = "https://app.fair-order.de",
}: ReceiptEmailProps) {
  // Group VAT by rate
  const vatGroups = new Map<number, { netCents: number; vatCents: number; grossCents: number }>();
  let totalGrossCents = 0;

  for (const item of items) {
    const rate = Number(item.vatRate);
    const grossCents = Math.round(Number(item.unitPrice) * 100) * item.quantity;
    const existing = vatGroups.get(rate) ?? { netCents: 0, vatCents: 0, grossCents: 0 };
    existing.netCents += item.netAmountCents;
    existing.vatCents += item.vatAmountCents;
    existing.grossCents += grossCents;
    vatGroups.set(rate, existing);
    totalGrossCents += grossCents;
  }

  const dateStr = new Date(createdAt).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const paymentLabel = paymentMethod === "stripe" ? "Kartenzahlung" : "Barzahlung";

  return (
    <Html lang="de">
      <Head />
      <Preview>{`Beleg f\u00fcr Bestellung #${orderNumber}`}</Preview>
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
            Beleg #{orderNumber}
          </Heading>

          <Text style={text}>
            Hallo {customerName}, hier ist dein Beleg f&uuml;r deine Bestellung
            bei <strong>{locationName}</strong>.
          </Text>

          {/* Item list */}
          <Section style={itemsSection}>
            {items.map((item, i) => (
              <Row key={i} style={itemRow}>
                <Column style={itemQty}>
                  {item.quantity}&times;
                </Column>
                <Column style={itemName}>
                  {item.menuItem.name}
                </Column>
                <Column style={itemPrice}>
                  {formatPrice(Number(item.unitPrice) * item.quantity)}
                </Column>
              </Row>
            ))}
          </Section>

          <Hr style={divider} />

          {/* VAT breakdown */}
          <Section style={vatSection}>
            {[...vatGroups.entries()].map(([rate, group]) => (
              <div key={rate}>
                <Row style={vatRow}>
                  <Column style={vatLabel}>Netto ({rate}%)</Column>
                  <Column style={vatValue}>{formatCents(group.netCents)}</Column>
                </Row>
                <Row style={vatRow}>
                  <Column style={vatLabel}>MwSt. {rate}%</Column>
                  <Column style={vatValue}>{formatCents(group.vatCents)}</Column>
                </Row>
              </div>
            ))}
          </Section>

          <Hr style={divider} />

          {/* Total */}
          <Row style={totalRow}>
            <Column style={totalLabel}>Gesamt</Column>
            <Column style={totalValue}>{formatCents(totalGrossCents)}</Column>
          </Row>

          <Text style={paymentText}>
            Bezahlt mit {paymentLabel}
          </Text>

          <Hr style={divider} />

          {/* Legal footer */}
          <Section style={legalSection}>
            {companyName && <Text style={legalText}>{companyName}</Text>}
            {address && <Text style={legalText}>{address}</Text>}
            {vatId && <Text style={legalMono}>USt-IdNr: {vatId}</Text>}
            <Text style={legalText}>{dateStr}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

ReceiptEmail.PreviewProps = {
  orderNumber: 47,
  customerName: "Max",
  locationName: "Mensa Nord",
  companyName: "Kantine Nord GmbH",
  address: "Musterstra\u00DFe 1, 12345 Berlin",
  vatId: "DE123456789",
  items: [
    {
      quantity: 2,
      unitPrice: 6.4,
      vatRate: 7,
      netAmountCents: 1196,
      vatAmountCents: 84,
      menuItem: { name: "Schnitzel", description: null },
    },
    {
      quantity: 1,
      unitPrice: 2.8,
      vatRate: 19,
      netAmountCents: 235,
      vatAmountCents: 45,
      menuItem: { name: "Apfelschorle", description: null },
    },
  ],
  createdAt: new Date("2026-03-26T12:15:00Z"),
  paymentMethod: "stripe",
} satisfies ReceiptEmailProps;

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
  margin: "16px 0",
};

const heading: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 800,
  margin: "0 0 16px",
  color: "#1C1917",
  fontFamily: "'JetBrains Mono', monospace",
};

const text: React.CSSProperties = {
  margin: "0 0 16px",
  fontSize: "14px",
  color: "#1C1917",
  lineHeight: "1.6",
};

const itemsSection: React.CSSProperties = {
  margin: "0 0 8px",
};

const itemRow: React.CSSProperties = {
  margin: "0 0 4px",
};

const itemQty: React.CSSProperties = {
  width: "40px",
  fontSize: "14px",
  color: "#57534E",
  fontFamily: "'JetBrains Mono', monospace",
};

const itemName: React.CSSProperties = {
  fontSize: "14px",
  color: "#1C1917",
};

const itemPrice: React.CSSProperties = {
  textAlign: "right" as const,
  fontSize: "14px",
  color: "#1C1917",
  fontFamily: "'JetBrains Mono', monospace",
};

const vatSection: React.CSSProperties = {
  margin: "0 0 8px",
};

const vatRow: React.CSSProperties = {
  margin: "0 0 2px",
};

const vatLabel: React.CSSProperties = {
  fontSize: "12px",
  color: "#57534E",
};

const vatValue: React.CSSProperties = {
  textAlign: "right" as const,
  fontSize: "12px",
  color: "#57534E",
  fontFamily: "'JetBrains Mono', monospace",
};

const totalRow: React.CSSProperties = {
  margin: "0 0 8px",
};

const totalLabel: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 800,
  color: "#1C1917",
};

const totalValue: React.CSSProperties = {
  textAlign: "right" as const,
  fontSize: "16px",
  fontWeight: 800,
  color: "#1C1917",
  fontFamily: "'JetBrains Mono', monospace",
};

const paymentText: React.CSSProperties = {
  fontSize: "12px",
  color: "#78716C",
  margin: "0 0 16px",
};

const legalSection: React.CSSProperties = {
  margin: "0",
};

const legalText: React.CSSProperties = {
  fontSize: "11px",
  color: "#57534E",
  margin: "0",
  lineHeight: "1.4",
};

const legalMono: React.CSSProperties = {
  fontSize: "11px",
  color: "#57534E",
  margin: "0",
  lineHeight: "1.4",
  fontFamily: "'JetBrains Mono', monospace",
};
