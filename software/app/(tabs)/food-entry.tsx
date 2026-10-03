/**
 * M1-12 Search — Recent / Favorites / My Foods + local FTS.
 * Does not open food detail / log sheet (M1-13).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  SectionList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  FoodRow,
  EmptyState,
  ErrorBanner,
  useTheme,
} from '@/design-system';
import { useUserData } from '@/components/UserDataProvider';
import { useFoodCatalog } from '@/components/FoodCatalogProvider';
import {
  buildBrowseSections,
  createSearchController,
  formatSearchA11ySummary,
  type BrowseSection,
  type EnrichedSearchResult,
  type SearchController,
} from '@/modules/food-catalog';
import {
  listCustomFoods,
  listFavorites,
  listRecentFoods,
} from '@/modules/app-core/user-data';

type ListRow = { key: string; name: string; detail: string };
type ListSection = { title: string; id: string; data: ListRow[] };

export default function SearchScreen() {
  const { colors, spacing, typography, radius } = useTheme();
  const { db: userDb, ready: userReady } = useUserData();
  const { repo, ready: catalogReady, error: catalogError } = useFoodCatalog();

  const [query, setQuery] = useState('');
  const [browsing, setBrowsing] = useState(true);
  const [results, setResults] = useState<EnrichedSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [browseTick, setBrowseTick] = useState(0);
  const controllerRef = useRef<SearchController | null>(null);

  const browseSections: BrowseSection[] = useMemo(() => {
    void browseTick;
    if (!userDb) {
      return buildBrowseSections({ seedRepo: repo });
    }
    return buildBrowseSections({
      recent: listRecentFoods(userDb).map((r) => ({
        foodKind: r.foodKind,
        foodStableId: r.foodStableId,
        foodDisplayName: r.foodDisplayName,
        foodLicenseTag: r.foodLicenseTag,
        foodBrand: r.foodBrand,
      })),
      favorites: listFavorites(userDb).map((f) => ({
        foodKind: f.foodKind,
        foodStableId: f.foodStableId,
        foodDisplayName: f.foodDisplayName,
        foodLicenseTag: f.foodLicenseTag,
        foodBrand: f.foodBrand,
      })),
      myFoods: listCustomFoods(userDb).map((c) => ({
        id: c.id,
        name: c.name,
        brand: c.brand,
        nutrients: c.nutrients,
      })),
      seedRepo: repo,
    });
  }, [userDb, repo, browseTick]);

  useEffect(() => {
    if (!repo) {
      controllerRef.current = null;
      return;
    }
    const controller = createSearchController(repo, {
      onResults: (_q, hits) => {
        setBrowsing(false);
        setResults(hits);
        setSearchError(null);
      },
      onBrowsing: () => {
        setBrowsing(true);
        setResults([]);
        setSearchError(null);
        setBrowseTick((n) => n + 1);
      },
      onError: (message) => setSearchError(message),
    });
    controllerRef.current = controller;
    // Catalog may finish loading after the user already typed.
    if (query.trim()) {
      setBrowsing(false);
      controller.setQuery(query);
    }
    return () => {
      controller.dispose();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bind once per repo; query synced on mount only
  }, [repo]);

  const onChangeQuery = (text: string) => {
    setQuery(text);
    if (text.trim()) {
      // Leave browse immediately so Recent/Favorites do not linger during debounce.
      setBrowsing(false);
    }
    controllerRef.current?.setQuery(text);
  };

  const onCancel = () => {
    setQuery('');
    controllerRef.current?.cancel();
  };

  const a11ySummary = formatSearchA11ySummary({
    query,
    resultCount: results.length,
    browsing,
  });

  const sections: ListSection[] = browsing
    ? browseSections
        .filter((s) => s.items.length > 0)
        .map((s) => ({
          id: s.id,
          title: s.title,
          data: s.items.map((i) => ({
            key: i.key,
            name: i.name,
            detail: i.detail,
          })),
        }))
    : [
        {
          id: 'results',
          title: 'Results',
          data: results.map((r) => ({
            key: r.foodId,
            name: r.name,
            detail: r.detail,
          })),
        },
      ];

  const showEmptyBrowse =
    browsing && browseSections.every((s) => s.items.length === 0);
  const showEmptyResults = !browsing && results.length === 0 && query.trim().length > 0;
  const ready = userReady && catalogReady;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.canvas }]}
      edges={['top', 'left', 'right']}
    >
      <View style={[styles.header, { paddingHorizontal: spacing.md, gap: spacing.sm }]}>
        <Text style={[typography.section, { color: colors.ink }]}>Search</Text>
        <View style={styles.searchRow}>
          <TextInput
            accessibilityLabel="Search foods"
            accessibilityRole="search"
            placeholder="Search for a food"
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={onChangeQuery}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="never"
            style={[
              styles.input,
              typography.body,
              {
                flex: 1,
                color: colors.ink,
                backgroundColor: colors.raised,
                borderColor: colors.divider,
                borderRadius: radius.card,
                paddingHorizontal: spacing.md,
                minHeight: 44,
              },
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel search"
            onPress={onCancel}
            hitSlop={8}
            style={({ pressed }) => [
              styles.cancelBtn,
              {
                minHeight: 44,
                minWidth: 44,
                paddingHorizontal: spacing.sm,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[typography.bodyStrong, { color: colors.ink }]}>Cancel</Text>
          </Pressable>
        </View>
        <Text
          accessibilityLiveRegion="polite"
          accessibilityLabel={a11ySummary}
          style={[typography.micro, { color: colors.muted }]}
        >
          {a11ySummary}
        </Text>
      </View>

      {catalogError ? (
        <View style={{ paddingHorizontal: spacing.md }}>
          <ErrorBanner
            title="Food catalog unavailable"
            message={catalogError}
            tone="error"
          />
        </View>
      ) : null}
      {searchError ? (
        <View style={{ paddingHorizontal: spacing.md }}>
          <ErrorBanner title="Search failed" message={searchError} tone="error" />
        </View>
      ) : null}

      {!ready ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.ink} />
          <Text style={[typography.body, { color: colors.muted, marginTop: spacing.sm }]}>
            Loading food catalog…
          </Text>
        </View>
      ) : showEmptyBrowse ? (
        <EmptyState
          title="Search USDA staples"
          message="Recent, Favorites, and My Foods appear here after you log foods. Start typing to search the offline catalog."
        />
      ) : showEmptyResults ? (
        <EmptyState
          title="No matching foods"
          message="Try another search. Packaged online search is not available offline."
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.key}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          renderSectionHeader={({ section }) =>
            !browsing && section.data.length === 0 ? null : (
              <Text
                style={[
                  typography.micro,
                  {
                    color: colors.muted,
                    paddingHorizontal: spacing.md,
                    paddingTop: spacing.md,
                    paddingBottom: spacing.xs,
                    textTransform: 'uppercase',
                  },
                ]}
              >
                {section.title}
              </Text>
            )
          }
          renderItem={({ item }) => (
            <FoodRow
              name={item.name}
              detail={item.detail}
              actionLabel="Select"
              onAction={() => {
                /* M1-13 food detail / log sheet — intentionally not opened here */
              }}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingTop: 8, paddingBottom: 4 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { borderWidth: StyleSheet.hairlineWidth },
  cancelBtn: { alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
