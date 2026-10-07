import React, { useState } from 'react';
import { ScrollView, Text, View, StyleSheet, Pressable } from 'react-native';
import { ThemeProvider, useTheme } from './theme';
import {
  PrimaryButton,
  Card,
  RaisedTile,
  MacroSummary,
  FoodRow,
  ErrorBanner,
  OfflinePill,
  EmptyState,
  LoadingState,
} from './components';
import type { ColorSchemeName } from './tokens';

/**
 * Interactive specimen gallery — visual parity reference for
 * macrofactor-codex-research/design-system/index.html sections
 * (controls, macro summary, food rows, banners, empty/loading).
 */
function GalleryBody() {
  const { colors, spacing, typography } = useTheme();
  const [dismissed, setDismissed] = useState(false);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: 48 }}
    >
      <View>
        <Text style={[typography.caption, { color: colors.ink, fontWeight: '800' }]}>
          DESIGN SYSTEM
        </Text>
        <Text style={[typography.display, { color: colors.ink, marginTop: 8 }]}>
          Component gallery
        </Text>
        <Text style={[typography.body, { color: colors.muted, marginTop: 8 }]}>
          Specimens ported from the HTML library. Tokens only — no raw hex in feature code.
        </Text>
        <View style={{ marginTop: spacing.md }}>
          <OfflinePill />
        </View>
      </View>

      <Section title="Controls">
        <View style={styles.row}>
          <PrimaryButton label="Primary" onPress={() => {}} />
          <PrimaryButton label="Secondary" variant="secondary" onPress={() => {}} />
        </View>
        <View style={[styles.row, { marginTop: spacing.sm }]}>
          <PrimaryButton label="Destructive" variant="destructive" onPress={() => {}} />
          <PrimaryButton label="Disabled" disabled onPress={() => {}} />
        </View>
      </Section>

      <Section title="Raised tile / card">
        <RaisedTile>
          <Text style={[typography.section, { color: colors.ink }]}>Expenditure</Text>
          <Text style={[typography.micro, { color: colors.muted, marginTop: 4 }]}>
            Last 7 Days
          </Text>
          <Text style={[typography.metricCompact, { color: colors.ink, marginTop: spacing.md }]}>
            2,940
            <Text style={[typography.caption, { color: colors.muted }]}> kcal</Text>
          </Text>
        </RaisedTile>
      </Section>

      <Section title="Macro summary">
        <MacroSummary
          totals={{
            calories: 1842,
            calorieGoal: 2560,
            protein: 136,
            proteinGoal: 160,
            fat: 67,
            fatGoal: 84,
            carbs: 194,
            carbsGoal: 280,
          }}
        />
      </Section>

      <Section title="Food rows">
        <Card padded={false} style={{ overflow: 'hidden' }}>
          <FoodRow
            name="Greek Yogurt, Vanilla"
            detail="130 Cal · 17P · 0F · 14C · 170 g"
            emoji="🥛"
            onAction={() => {}}
          />
          <FoodRow
            name="Chicken Breast, Grilled"
            detail="248 Cal · 46P · 5F · 0C · 150 g"
            emoji="🍗"
            onAction={() => {}}
          />
          <FoodRow
            name="Blueberries, Fresh"
            detail="84 Cal · 1P · 0F · 21C · 148 g"
            emoji="🫐"
            onAction={() => {}}
          />
        </Card>
      </Section>

      <Section title="Banners">
        {!dismissed ? (
          <ErrorBanner
            tone="education"
            title="What is Weight Trend?"
            message="Trend weight smooths day-to-day changes so the longer-term direction stays easy to read."
            actionLabel="Learn more"
            onAction={() => {}}
            onDismiss={() => setDismissed(true)}
          />
        ) : null}
        <ErrorBanner
          tone="error"
          title="Couldn’t save entry"
          message="Check storage space and try again. Your draft is still on this device."
          actionLabel="Retry"
          onAction={() => {}}
        />
        <ErrorBanner
          tone="neutral"
          title="Check-in complete"
          message="Your targets are ready for the coming week."
          actionLabel="View"
          onAction={() => {}}
        />
      </Section>

      <Section title="Empty / loading">
        <Card>
          <EmptyState
            title="No foods logged"
            message="Search USDA staples or create a custom food to start your day."
            actionLabel="Add food"
            onAction={() => {}}
          />
        </Card>
        <Card padded={false} style={{ marginTop: spacing.md }}>
          <LoadingState />
        </Card>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[typography.section, { color: colors.ink }]}>{title}</Text>
      {children}
    </View>
  );
}

export function ComponentGallery({
  forcedScheme,
}: {
  forcedScheme?: ColorSchemeName;
}) {
  const [scheme, setScheme] = useState<ColorSchemeName | undefined>(forcedScheme);

  return (
    <ThemeProvider forcedScheme={scheme}>
      <View style={{ flex: 1 }}>
        <SchemeToggle scheme={scheme} onChange={setScheme} />
        <GalleryBody />
      </View>
    </ThemeProvider>
  );
}

function SchemeToggle({
  scheme,
  onChange,
}: {
  scheme?: ColorSchemeName;
  onChange: (s: ColorSchemeName | undefined) => void;
}) {
  const { colors, spacing, typography, radius } = useTheme();
  const options: Array<{ id: ColorSchemeName | 'system'; label: string }> = [
    { id: 'system', label: 'System' },
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
  ];
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.xs,
        padding: spacing.sm,
        backgroundColor: colors.band,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.divider,
      }}
    >
      {options.map((opt) => {
        const active =
          opt.id === 'system' ? scheme == null : scheme === opt.id;
        return (
          <Pressable
            key={opt.id}
            accessibilityRole="button"
            accessibilityLabel={`Color scheme: ${opt.label}`}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.id === 'system' ? undefined : opt.id)}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              minHeight: 44,
              justifyContent: 'center',
              borderRadius: radius.pill,
              backgroundColor: active ? colors.ink : colors.control,
            }}
          >
            <Text
              style={[
                typography.caption,
                { color: active ? colors.raised : colors.ink, fontWeight: '700' },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
