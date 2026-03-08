import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import "../global.css";
import { supabase } from "../lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { registerForPushNotifications } from "../lib/notifications";
import { Modal, Pressable, Text, View } from "react-native";

const SAFETY_REMINDER_TITLE = "Safety Reminder";
const SAFETY_REMINDER_MESSAGE =
  "PopIn connects OSU students. Everyone is verified with an @osu.edu email. Always meet in public campus spaces.";
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
      <Modal
        visible={showSafetyReminder}
        transparent
        animationType="fade"
        onRequestClose={dismissSafetyReminder}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "center",
            paddingHorizontal: 20,
          }}
        >
          <View className="bg-white rounded-2xl p-6">
            <Text className="text-xl font-bold text-osu-dark mb-3">{SAFETY_REMINDER_TITLE}</Text>
            <Text className="text-base text-gray-700 leading-6">{SAFETY_REMINDER_MESSAGE}</Text>

            <Pressable
              className="mt-6 bg-osu-scarlet rounded-xl py-3 items-center"
              onPress={dismissSafetyReminder}
            >
              <Text className="text-white font-semibold">Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
