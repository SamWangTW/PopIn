import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import "../global.css";
import { supabase } from "../lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { registerForPushNotifications } from "../lib/notifications";
import { Pressable, Text, View } from "react-native";

const SAFETY_REMINDER_TITLE = "Safety Reminder";
const SAFETY_REMINDER_MESSAGE =
  "Be cautious when meeting people from PopIn. Events started with [Testing] and hosted by popin-team are for testing only.";
const SAFETY_DISMISSED_KEY_PREFIX = "safety-reminder-dismissed:";

const getSafetyDismissedKey = (userId: string) =>
  `${SAFETY_DISMISSED_KEY_PREFIX}${userId}`;

const hasDismissedSafetyReminder = (userId: string): boolean => {
  try {
    return globalThis.sessionStorage?.getItem(getSafetyDismissedKey(userId)) === "1";
  } catch {
    return false;
  }
};

const markSafetyReminderDismissed = (userId: string) => {
  try {
    globalThis.sessionStorage?.setItem(getSafetyDismissedKey(userId), "1");
  } catch {
    // Ignore storage failures so auth flow never breaks.
  }
};

const clearSafetyReminderDismissedFlags = () => {
  try {
    const storage = globalThis.sessionStorage;
    if (!storage) return;

    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key?.startsWith(SAFETY_DISMISSED_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => storage.removeItem(key));
  } catch {
    // Ignore storage failures so auth flow never breaks.
  }
};

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSafetyReminder, setShowSafetyReminder] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session?.user?.id) {
        registerForPushNotifications(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);

      if (event === "SIGNED_OUT") {
        clearSafetyReminderDismissedFlags();
      }

      if (session?.user?.id) {
        registerForPushNotifications(session.user.id);
      }

      if (
        event === "SIGNED_IN" &&
        session?.user?.id &&
        !hasDismissedSafetyReminder(session.user.id)
      ) {
        setShowSafetyReminder(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;

    const inApp = segments[0] === "(app)";

    if (!session && inApp) {
      router.replace("/");
    } else if (session && !inApp) {
      router.replace("/(app)/(tabs)/feed");
    }
  }, [session, segments, loading]);

  const dismissSafetyReminder = () => {
    if (session?.user?.id) {
      markSafetyReminderDismissed(session.user.id);
    }
    setShowSafetyReminder(false);
  };

  return (
    <>
      <Slot />
      {showSafetyReminder ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            paddingHorizontal: 16,
            paddingTop: 8,
          }}
        >
          <View className="bg-white rounded-xl p-3 border border-gray-200 shadow-lg self-center w-full max-w-2xl">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-base font-semibold text-osu-dark">{SAFETY_REMINDER_TITLE}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close safety reminder"
                className="w-7 h-7 items-center justify-center rounded-full bg-gray-100"
                onPress={dismissSafetyReminder}
              >
                <Text className="text-sm font-semibold text-gray-600">X</Text>
              </Pressable>
            </View>

            <Text className="text-sm text-gray-700 leading-5">{SAFETY_REMINDER_MESSAGE}</Text>

            <Pressable
              className="mt-2 bg-osu-scarlet rounded-lg py-2 items-center"
              onPress={dismissSafetyReminder}
            >
              <Text className="text-white text-sm font-semibold">Got it</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </>
  );
}
