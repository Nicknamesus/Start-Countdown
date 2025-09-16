// 2) app/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
const countdownBeep = require("../assets/countdown-beep.mp3");
const finalBeep = require("../assets/final-beep.mp3");

export default function Index() {
  const [countdownSec, setCountdownSec] = useState("3");
  const [maxWaitSec, setMaxWaitSec] = useState("2");

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
    setAudioModeAsync({
      playsInSilentMode: true,
    });
  }, []);
  const tickPlayer = useAudioPlayer(countdownBeep); // short tick each second
  const finalPlayer = useAudioPlayer(finalBeep); // 2s higher-pitched final beep

  // Animated UI toggle between idle <-> running
  const uiMode = useRef(new Animated.Value(0)).current; // 0 = idle, 1 = running
  useEffect(() => {
    const toValue = phase === "idle" ? 0 : 1;
    Animated.timing(uiMode, {
      toValue,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [phase, uiMode]);

  // reset remaining when total changes (only while idle)
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
      // pause is handled by toggling and re-baselining; no need to branch here
      const elapsed = Date.now() - startAt;
      const nextRemaining = Math.max(0, totalCountdownMs - elapsed);
      setRemainingMs(nextRemaining);
      if (nextRemaining <= 0) {
        if (intervalRef.current !== null) {
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
            finalPlayer.seekTo(0);
            finalPlayer.play();
          } catch (e) {
            console.warn("Beep error", e);
          }
          setPhase("idle");
        }, randomDelay);
      }
    }, 50);
  }, [clearTimers, totalCountdownMs, maxWaitMs]);

  const stop = useCallback(() => {
    clearTimers();
    setPaused(false);
    setPhase("idle");
    setRemainingMs(totalCountdownMs);
  }, [clearTimers, totalCountdownMs]);

  const togglePause = useCallback(() => {
    if (phase !== "countdown") return;
    setPaused((p) => {
      if (!p) {
        // going into pause — freeze the timer
        clearTimers(); // 👈 stop the running interval so remainingMs stops changing
        resumeBaseRef.current = {
          remainingAtPause: remainingMs,
          pausedAt: Date.now(),
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
            if (intervalRef.current !== null) {
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
                finalPlayer.seekTo(0);
                finalPlayer.play();
              } catch (e) {
                console.warn("Beep error", e);
              }
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

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
    });
  }, []);

  // Play a tick each time the displayed second changes during countdown
  const lastSecondRef = useRef<number | null>(null);
  useEffect(() => {
    if (phase === "countdown") {
      const sec = Math.ceil(remainingMs / 1000);
      if (lastSecondRef.current !== sec) {
        lastSecondRef.current = sec;
        if (sec > 0) {
          tickPlayer.seekTo(0);
          tickPlayer.play();
        }
      }
    }
  }, [remainingMs, phase, tickPlayer]);

  // Animated styles
  const idleOpacity = uiMode.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const idleTranslate = uiMode.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 12],
  });
  const runOpacity = uiMode.interpolate({
    inputRange: [0, 1],
    outputRange: [-1, 1],
  });
  const runTranslate = uiMode.interpolate({
    inputRange: [0, 1],
    outputRange: [-50, 120],
  });
  const circleScale = uiMode.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.2],
  });
  const circleTranslate = uiMode.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 100], // 0 in idle, +24px when timer is active
  });

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.container}>
        {/* Circular progress with animated scale */}
        <View style={styles.circleWrap}>
          <Animated.View
            style={[
              styles.circleWrap,
              {
                transform: [
                  { translateY: circleTranslate },
                  { scale: circleScale },
                ],
              },
            ]}
          >
            <Svg width={size} height={size}>
              <Defs>
                <LinearGradient
                  id="progressGradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <Stop offset="0%" stopColor="#9D7BFF" />
                  <Stop offset="100%" stopColor="#6BA5FF" />
                </LinearGradient>
              </Defs>
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={"url(#progressGradient)"}
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
          </Animated.View>
        </View>

        <View style={styles.controlsHost}>
          {/* IDLE CONFIG (kept mounted; fades/slides out) */}
          <Animated.View
            pointerEvents={phase === "idle" ? "auto" : "none"}
            style={{
              ...(StyleSheet.absoluteFill as any),
              opacity: idleOpacity,
              transform: [{ translateY: idleTranslate }],
            }}
          >
            <View style={styles.configWrap}>
              <View className="inputRow" style={styles.inputRow}>
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
              <Text style={styles.note}>
                Tip: set Max wait to 0 for an immediate beep at the end.
              </Text>
            </View>

            <View style={{ alignItems: "center", marginTop: 16 }}>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={start}
                style={[styles.ctrlBtn, styles.startBtn]}
              >
                <Ionicons name="play" size={18} color="#052e16" />
                <Text style={styles.startText}>Start</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* RUN CONTROLS (kept mounted; fade/slide in) */}
          <Animated.View
            pointerEvents={phase !== "idle" ? "auto" : "none"}
            style={{
              ...(StyleSheet.absoluteFill as any),
              opacity: runOpacity,
              transform: [{ translateY: runTranslate }],
              alignItems: "center",
              justifyContent: "flex-start",
            }}
          >
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
                <Text style={styles.ctrlText}>
                  {paused ? "Resume" : "Pause"}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0B0F14" },
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 100,
    alignItems: "center",
    justifyContent: "flex-start",
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
  controlsHost: {
    position: "relative",
    width: "100%",
    minHeight: 160,
    marginTop: 8,
  },
  runControls: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
    justifyContent: "center",
  },
  ctrlBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center", // center content
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20, // uniform padding
    borderRadius: 9999,
    width: 110,
  },
  stopBtn: {
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#4b5563",
  },
  pauseBtn: { backgroundColor: "#065f46" },
  startBtn: { backgroundColor: "#34D399" },

  ctrlText: { color: "#E5E7EB", fontWeight: "700" },
  startText: { color: "#052e16", fontWeight: "700" },
  note: { color: "#6B7280", marginTop: 16 },
});
