// 2) app/index.tsx
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
// Optional audio: expo-av + add ./assets/beep.mp3
// import { Audio } from 'expo-av';
// const BEEP = require('../assets/beep.mp3');

export default function Index() {
  const [countdownSec, setCountdownSec] = useState("10");
  const [maxWaitSec, setMaxWaitSec] = useState("5");

  const [phase, setPhase] = useState<"idle" | "countdown" | "waiting">("idle");
  const [paused, setPaused] = useState(false);

  const totalCountdownMs = useMemo(
    () => Math.max(0, Math.round(parseFloat(countdownSec || "0") * 1000)),
    [countdownSec]
  );
  const maxWaitMs = useMemo(
    () => Math.max(0, Math.round(parseFloat(maxWaitSec || "0") * 1000)),
    [maxWaitSec]
  );

  const [remainingMs, setRemainingMs] = useState(totalCountdownMs);
  const waitTimeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const resumeBaseRef = useRef<{
    remainingAtPause: number;
    pausedAt: number;
  } | null>(null);

  useEffect(() => {
    if (phase === "idle") setRemainingMs(totalCountdownMs);
  }, [totalCountdownMs, phase]);

  const clearTimers = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (waitTimeoutRef.current !== null) {
      clearTimeout(waitTimeoutRef.current);
      waitTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const start = useCallback(() => {
    clearTimers();
    setPaused(false);
    setPhase("countdown");
    setRemainingMs(totalCountdownMs);

    const startAt = Date.now();
    intervalRef.current = setInterval(() => {
      if (paused) return;
      const elapsed = Date.now() - startAt;
      const nextRemaining = Math.max(0, totalCountdownMs - elapsed);
      setRemainingMs(nextRemaining);
      if (nextRemaining <= 0) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setPhase("waiting");
        const randomDelay =
          maxWaitMs > 0 ? Math.floor(Math.random() * (maxWaitMs + 1)) : 0; // 0..max
        waitTimeoutRef.current = setTimeout(async () => {
          try {
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success
            );
          } catch {}
          // Optional audio
          // try {
          //   const { sound } = await Audio.Sound.createAsync(BEEP);
          //   await sound.playAsync();
          //   sound.setOnPlaybackStatusUpdate((status) => {
          //     if (!status.isLoaded || status.didJustFinish) sound.unloadAsync();
          //   });
          // } catch {}
          setPhase("idle");
        }, randomDelay);
      }
    }, 50);
  }, [clearTimers, totalCountdownMs, maxWaitMs, paused]);

  const stop = useCallback(() => {
    clearTimers();
    setPaused(false);
    setPhase("idle");
    setRemainingMs(totalCountdownMs);
  }, [clearTimers, totalCountdownMs]);

  const togglePause = useCallback(() => {
    if (phase !== "countdown") return;
    setPaused((p) => {
      const now = Date.now();
      if (!p) {
        // going into pause
        resumeBaseRef.current = {
          remainingAtPause: remainingMs,
          pausedAt: now,
        };
      } else if (resumeBaseRef.current) {
        // resuming: re-baseline the countdown by restarting with remaining time
        clearTimers();
        const { remainingAtPause } = resumeBaseRef.current;
        const startAt = Date.now();
        intervalRef.current = setInterval(() => {
          const elapsed = Date.now() - startAt;
          const nextRemaining = Math.max(0, remainingAtPause - elapsed);
          setRemainingMs(nextRemaining);
          if (nextRemaining <= 0) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            setPhase("waiting");
            const randomDelay =
              maxWaitMs > 0 ? Math.floor(Math.random() * (maxWaitMs + 1)) : 0;
            waitTimeoutRef.current = setTimeout(async () => {
              try {
                await Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success
                );
              } catch {}
              setPhase("idle");
            }, randomDelay);
          }
        }, 50);
      }
      return !p;
    });
  }, [phase, remainingMs, maxWaitMs, clearTimers]);

  // Circular progress visuals
  const size = 240;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = useMemo(() => {
    if (totalCountdownMs === 0) return 0;
    return Math.min(1, Math.max(0, 1 - remainingMs / totalCountdownMs));
  }, [remainingMs, totalCountdownMs]);

  const secondsLeft = Math.ceil(remainingMs / 1000);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.container}>
        {/* Hourglass badge 
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Ionicons name="hourglass" size={42} color="#C7F9CC" />
          </View>
        </View>*/}

        {/* Circular progress */}
        <View style={styles.circleWrap}>
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#42caf4ff"
              strokeWidth={stroke}
              fill="none"
            />
            {/* #6EE7B7 */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#2A2F35"
              strokeWidth={stroke + 0.8}
              strokeLinecap="butt"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={circumference * (1 - progress) * -1}
              fill="none"
              rotation="-90"
              origin={`${size / 2}, ${size / 2}`}
            />
          </Svg>
          <View style={styles.centerLabel}>
            {phase === "waiting" ? (
              <Text style={styles.countText}>…</Text>
            ) : (
              <Text style={styles.countText}>
                {isFinite(secondsLeft) ? secondsLeft : 0}
              </Text>
            )}
            <Text style={styles.subText}>
              {phase === "idle" && "Ready"}
              {phase === "countdown" && (paused ? "Paused" : "Counting")}
              {phase === "waiting" && "Waiting…"}
            </Text>
          </View>
        </View>

        {phase === "idle" ? (
          <>
            <View style={styles.configWrap}>
              <View style={styles.inputRow}>
                <Text style={styles.label}>Countdown (sec)</Text>
                <TextInput
                  style={styles.input}
                  value={countdownSec}
                  onChangeText={(t) =>
                    setCountdownSec(t.replace(/[^0-9.]/g, ""))
                  }
                  keyboardType={Platform.select({
                    ios: "decimal-pad",
                    android: "numeric",
                  })}
                  placeholder="10"
                  placeholderTextColor="#6B7280"
                />
              </View>
              <View style={styles.inputRow}>
                <Text style={styles.label}>Max wait before beep (sec)</Text>
                <TextInput
                  style={styles.input}
                  value={maxWaitSec}
                  onChangeText={(t) => setMaxWaitSec(t.replace(/[^0-9.]/g, ""))}
                  keyboardType={Platform.select({
                    ios: "decimal-pad",
                    android: "numeric",
                  })}
                  placeholder="5"
                  placeholderTextColor="#6B7280"
                />
              </View>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={start}
              style={styles.startBtn}
            >
              <Ionicons name="play" size={22} color="#052e16" />
              <Text style={styles.startText}>Start</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.runControls}>
            <TouchableOpacity
              onPress={stop}
              style={[styles.ctrlBtn, styles.stopBtn]}
            >
              <Ionicons name="stop" size={18} color="#fecaca" />
              <Text style={styles.ctrlText}>Stop</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={phase !== "countdown"}
              onPress={togglePause}
              style={[
                styles.ctrlBtn,
                styles.pauseBtn,
                phase !== "countdown" && { opacity: 0.5 },
              ]}
            >
              <Ionicons
                name={paused ? "play" : "pause"}
                size={18}
                color="#d1fae5"
              />
              <Text style={styles.ctrlText}>{paused ? "Resume" : "Pause"}</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.note}>
          Tip: set Max wait to 0 for an immediate beep at the end.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0B0F14" },
  container: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: { marginBottom: 12 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  circleWrap: {
    marginVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  centerLabel: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { color: "#E5E7EB", fontSize: 48, fontWeight: "800" },
  subText: { color: "#9CA3AF", marginTop: 2 },
  configWrap: { width: "100%", gap: 12, marginTop: 8 },
  inputRow: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  label: { color: "#E5E7EB", marginBottom: 8, fontWeight: "600" },
  input: {
    color: "#E5E7EB",
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
    fontVariant: ["tabular-nums"],
  },
  startBtn: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#34D399",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 9999,
    shadowColor: "#34D399",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  startText: { color: "#052e16", fontWeight: "800", fontSize: 16 },
  runControls: { flexDirection: "row", gap: 12, marginTop: 10 },
  ctrlBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 9999,
  },
  stopBtn: {
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#4b5563",
  },
  pauseBtn: { backgroundColor: "#065f46" },
  ctrlText: { color: "#E5E7EB", fontWeight: "700" },
  note: { color: "#6B7280", marginTop: 16 },
});
