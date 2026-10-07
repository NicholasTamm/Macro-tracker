/**
 * M1-12 Search + M1-13 detail/log + M1-15 custom foods + M1-16 favorites/recents/quick-add.
 * Select opens detail sheet; Quick-add logs with remembered qty/unit; star toggles favorite.
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
import { useRouter } from 'expo-router';
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
  formatResultDetail,
  formatSearchA11ySummary,
  type BrowseSection,
  type EnrichedSearchResult,
  type SearchController,
} from '@/modules/food-catalog';
import {
  ensureDefaultMealSlots,
  getCustomFood,
  listCustomFoods,
  listFavorites,
  listMealSlots,
  listRecentFoods,
  type CustomFood,
} from '@/modules/app-core/user-data';
import {
  buildCustomFoodDetail,
  buildSeedFoodDetail,
  type FoodDetailModel,
} from '@/modules/diary';
import { FoodDetailSheet } from '@/modules/diary/food-detail/FoodDetailSheet';
import { CustomFoodEditorSheet } from '@/modules/diary/custom-food/CustomFoodEditorSheet';
import { quickAddFood } from '@/modules/diary/favorites-recents/quickAdd';

type ListRow = {
  key: string;
  name: string;
  detail: string;
  foodKind: 'seed' | 'custom' | 'off' | 'fdc_branded' | 'fatsecret';
  foodStableId: string;
  sectionId: string;
};
type ListSection = { title: string; id: string; data: ListRow[] };

export default function SearchScreen() {
  const { colors, spacing, typography, radius } = useTheme();
  const { db: userDb, ready: userReady, snapshot, refresh } = useUserData();
  const { repo, ready: catalogReady, error: catalogError } = useFoodCatalog();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [browsing, setBrowsing] = useState(true);
  const [results, setResults] = useState<EnrichedSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [browseTick, setBrowseTick] = useState(0);
  const [detailModel, setDetailModel] = useState<FoodDetailModel | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorFood, setEditorFood] = useState<CustomFood | null>(null);
  const controllerRef = useRef<SearchController | null>(null);
  const energyUnit = snapshot?.profile.energyUnit ?? 'kcal';

  const browseSections: BrowseSection[] = useMemo(() => {
    void browseTick;
    if (!userDb) {
      return buildBrowseSections({ seedRepo: repo, energyUnit });
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
      energyUnit,
    });
  }, [userDb, repo, browseTick, energyUnit]);

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
      setBrowsing(false);
    }
    controllerRef.current?.setQuery(text);
  };

  const onCancel = () => {
    setQuery('');
    controllerRef.current?.cancel();
  };

  const openDetail = (foodKind: ListRow['foodKind'], foodStableId: string) => {
    setDetailError(null);
    if (foodKind === 'seed') {
      if (!repo) {
        setDetailError('Food catalog unavailable.');
        return;
      }
      const model = buildSeedFoodDetail(repo, foodStableId);
      if (!model) {
        setDetailError('Food not found in catalog.');
        return;
      }
      setDetailModel(model);
      setDetailOpen(true);
      return;
    }
    if (foodKind === 'custom') {
      if (!userDb) {
        setDetailError('User data unavailable.');
        return;
      }
      const custom = getCustomFood(userDb, foodStableId);
      if (!custom) {
        setDetailError('Custom food not found.');
        return;
      }
      setDetailModel(buildCustomFoodDetail(custom));
      setDetailOpen(true);
      return;
    }
    setDetailError('Only offline seed and My Foods can be logged in M1.');
  };

  const openCreateCustom = () => {
    setEditorFood(null);
    setEditorOpen(true);
  };

  const openEditCustom = (foodStableId: string) => {
    if (!userDb) {
      setDetailError('User data unavailable.');
      return;
    }
    const custom = getCustomFood(userDb, foodStableId);
    if (!custom) {
      setDetailError('Custom food not found.');
      return;
    }
    setEditorFood(custom);
    setEditorOpen(true);
  };

  const onQuickAdd = (foodKind: ListRow['foodKind'], foodStableId: string) => {
    if (!userDb) {
      setDetailError('User data unavailable.');
      return;
    }
    ensureDefaultMealSlots(userDb);
    const slots = listMealSlots(userDb);
    const mealSlotId = slots[0]?.id ?? null;
    const result = quickAddFood(userDb, repo, {
      foodKind,
      foodStableId,
      mealSlotId,
    });
    if (!result.ok) {
      setDetailError(result.reason);
      return;
    }
    refresh();
    setBrowseTick((n) => n + 1);
    router.push('/(tabs)/today');
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
            foodKind: i.foodKind,
            foodStableId: i.foodStableId,
            sectionId: s.id,
          })),
        }))
    : [
        {
          id: 'results',
          title: 'Results',
          data: results.map((r) => ({
            key: r.foodId,
            name: r.name,
            detail: formatResultDetail(r.sourceLabel, r.macros, energyUnit),
            foodKind: 'seed' as const,
            foodStableId: r.foodId,
            sectionId: 'results',
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
                borderColor: colors.controlBorder,
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create custom food"
          onPress={openCreateCustom}
          hitSlop={8}
          style={({ pressed }) => [
            {
              alignSelf: 'flex-start',
              minHeight: 44,
              justifyContent: 'center',
              paddingHorizontal: spacing.sm,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[typography.bodyStrong, { color: colors.ink }]}>
            + Create custom food
          </Text>
        </Pressable>
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
      {detailError ? (
        <View style={{ paddingHorizontal: spacing.md }}>
          <ErrorBanner
            title="Cannot open food"
            message={detailError}
            tone="error"
            actionLabel="Dismiss"
            onAction={() => setDetailError(null)}
          />
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
            <View>
              <FoodRow
                name={item.name}
                detail={item.detail}
                actionLabel="Select"
                onAction={() => openDetail(item.foodKind, item.foodStableId)}
              />
              {item.sectionId === 'recent' || item.sectionId === 'favorites' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Quick-add ${item.name}`}
                  onPress={() => onQuickAdd(item.foodKind, item.foodStableId)}
                  hitSlop={8}
                  style={{
                    minHeight: 44,
                    paddingHorizontal: spacing.md,
                    justifyContent: 'center',
                    marginBottom: spacing.xs,
                  }}
                >
                  <Text style={[typography.micro, { color: colors.muted }]}>
                    Quick-add
                  </Text>
                </Pressable>
              ) : null}
              {item.foodKind === 'custom' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${item.name}`}
                  onPress={() => openEditCustom(item.foodStableId)}
                  hitSlop={8}
                  style={{
                    minHeight: 44,
                    paddingHorizontal: spacing.md,
                    justifyContent: 'center',
                    marginBottom: spacing.xs,
                  }}
                >
                  <Text style={[typography.micro, { color: colors.muted }]}>
                    Edit custom food
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
        />
      )}

      <FoodDetailSheet
        visible={detailOpen}
        model={detailModel}
        db={userDb}
        energyUnit={energyUnit}
        onClose={() => {
          setDetailOpen(false);
          setDetailModel(null);
        }}
        onLogged={() => {
          setDetailOpen(false);
          setDetailModel(null);
          refresh();
          setBrowseTick((n) => n + 1);
          router.push('/(tabs)/today');
        }}
      />

      <CustomFoodEditorSheet
        visible={editorOpen}
        db={userDb}
        food={editorFood}
        energyUnit={energyUnit}
        onClose={() => {
          setEditorOpen(false);
          setEditorFood(null);
        }}
        onSaved={() => {
          setEditorOpen(false);
          setEditorFood(null);
          refresh();
          setBrowseTick((n) => n + 1);
        }}
      />
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
