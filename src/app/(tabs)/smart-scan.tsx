import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

type Scan = {
  id: string;
  userId: string;
  imageUrl: string | null;
  status: string;
  createdAt: string;
};

type ScanResult = {
  id: string;
  scanSessionId: string;
  label: string;
  count: number;
  confidence: number | null;
  inventoryItemId: string | null;
};

const THEME = {
  bg: "#0B1220",
  card: "#0F172A",
  card2: "#111827",
  border: "#1F2937",
  text: "#E5E7EB",
  muted: "#94A3B8",
  accent: "#10B981",
  danger: "#EF4444",
};

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: THEME.card,
          borderColor: THEME.border,
          borderWidth: 1,
          borderRadius: 14,
          padding: 14,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function Button({
  title,
  onPress,
  disabled,
  variant = "primary",
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const bg =
    variant === "primary"
      ? THEME.accent
      : variant === "secondary"
      ? THEME.card2
      : "transparent";

  const borderWidth = variant === "ghost" ? 1 : 1;
  const borderColor = variant === "primary" ? "transparent" : THEME.border;

  const textColor = variant === "primary" ? "#04120C" : THEME.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: disabled ? "#334155" : bg,
        borderWidth,
        borderColor,
        opacity: disabled ? 0.8 : 1,
      }}
    >
      <Text style={{ color: textColor, fontWeight: "800", textAlign: "center" }}>
        {title}
      </Text>
    </Pressable>
  );
}

export default function SmartScanScreen() {
  // ✅ Your backend on LAN (PC) so iPhone can reach it
  const API_BASE = "http://192.168.68.55:3334";

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => a.label.localeCompare(b.label));
  }, [results]);

  async function pingHealth() {
    try {
      const r = await fetch(`${API_BASE}/health`);
      const t = await r.text();
      Alert.alert("Backend health", `${r.status}: ${t}`);
    } catch (e: any) {
      Alert.alert("Backend health failed", e?.message ?? String(e));
    }
  }

  async function pickImage() {
    setError(null);
    setResults([]);
    setScan(null);

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Permission needed to access photos.");
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });

    if (res.canceled) return;
    setImageUri(res.assets[0].uri);
  }

  async function runSmartScan() {
    if (!imageUri) {
      setError("Pick an image first.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      // 1) start scan session
      const startResp = await fetch(`${API_BASE}/api/scan/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      if (!startResp.ok) {
        const t = await startResp.text();
        throw new Error(`start failed: ${startResp.status} ${t}`);
      }

      const started: Scan = await startResp.json();
      setScan(started);

      // 2) upload image to scan
      const form = new FormData();
      form.append(
        "file",
        {
          uri: imageUri,
          name: "photo.jpg",
          type: "image/jpeg",
        } as any
      );

      const uploadResp = await fetch(`${API_BASE}/api/scan/${started.id}/upload`, {
        method: "POST",
        body: form,
        // IMPORTANT: don't set Content-Type manually for multipart
      });

      if (!uploadResp.ok) {
        const t = await uploadResp.text();
        throw new Error(`upload failed: ${uploadResp.status} ${t}`);
      }

      const uploaded: Scan = await uploadResp.json();
      setScan(uploaded);

      // 3) run scan (AI or stub)
      const runResp = await fetch(`${API_BASE}/api/scan/${started.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      if (!runResp.ok) {
        const t = await runResp.text();
        throw new Error(`run failed: ${runResp.status} ${t}`);
      }

      const payload = await runResp.json();
      setScan(payload.scan);
      setResults(payload.results ?? []);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: THEME.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        <Text style={{ fontSize: 22, fontWeight: "900", color: THEME.text }}>
          Smart Scan
        </Text>
        <Text style={{ color: THEME.muted }}>
          Backend: <Text style={{ color: THEME.text }}>{API_BASE}</Text>
        </Text>

        <Card style={{ gap: 10 }}>
          <Button title="Ping backend" onPress={pingHealth} variant="secondary" />
          <Button title="Pick photo" onPress={pickImage} variant="ghost" />
          <Button
            title={busy ? "Scanning..." : "Run scan"}
            onPress={runSmartScan}
            disabled={busy || !imageUri}
            variant="primary"
          />

          {error ? (
            <Text style={{ color: THEME.danger, fontWeight: "800" }}>{error}</Text>
          ) : null}
        </Card>

        {busy ? (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ActivityIndicator />
              <Text style={{ color: THEME.text, fontWeight: "700" }}>
                Working…
              </Text>
            </View>
          </Card>
        ) : null}

        {imageUri ? (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <Image source={{ uri: imageUri }} style={{ width: "100%", height: 260 }} />
          </Card>
        ) : null}

        {scan ? (
          <Card style={{ gap: 6 }}>
            <Text style={{ color: THEME.text, fontWeight: "900" }}>Scan Session</Text>
            <Text style={{ color: THEME.muted }}>
              ID: <Text style={{ color: THEME.text }}>{scan.id}</Text>
            </Text>
            <Text style={{ color: THEME.muted }}>
              Status: <Text style={{ color: THEME.text }}>{scan.status}</Text>
            </Text>
            {scan.imageUrl ? (
              <Text style={{ color: THEME.muted }}>
                Image: <Text style={{ color: THEME.text }}>{scan.imageUrl}</Text>
              </Text>
            ) : null}
          </Card>
        ) : null}

        {sortedResults.length ? (
          <View style={{ gap: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: "900", color: THEME.text }}>
              Results
            </Text>

            {sortedResults.map((r) => (
              <Card key={r.id} style={{ gap: 6 }}>
                <Text style={{ fontSize: 16, fontWeight: "900", color: THEME.text }}>
                  {r.label}
                </Text>
                <Text style={{ color: THEME.muted }}>
                  Count: <Text style={{ color: THEME.text }}>{r.count}</Text>
                </Text>
                {r.confidence !== null ? (
                  <Text style={{ color: THEME.muted }}>
                    Confidence:{" "}
                    <Text style={{ color: THEME.text }}>
                      {Math.round(r.confidence * 100)}%
                    </Text>
                  </Text>
                ) : null}
              </Card>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
