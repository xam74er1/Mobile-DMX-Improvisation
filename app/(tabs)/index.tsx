import React, { useState, useEffect } from 'react'
import { ScrollView, StyleSheet, View, TouchableOpacity, Modal, Pressable } from 'react-native'
import { FAB, Portal, Dialog, TextInput, Button, Text } from 'react-native-paper'
import { MaterialIcons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { BlackoutButton } from '../../src/components/BlackoutButton'
import { AmbianceCard } from '../../src/components/AmbianceCard'
import { EffectsBar } from '../../src/components/EffectsBar'
import { useAmbiancesStore } from '../../src/store/ambiancesStore'
import type { AmbianceCategory } from '../../src/store/ambiancesStore'
import { useRouter } from 'expo-router'
import { effectsRunner } from '../../src/effects/runner'

// ─────────────────────────────────────────────────────────────
// Icon picker options (MaterialIcons names)
// ─────────────────────────────────────────────────────────────
const AMBIANCE_ICONS: Array<{ name: string; label: string }> = [
  { name: 'wb-sunny',            label: 'Sun' },
  { name: 'wb-incandescent',     label: 'Bulb' },
  { name: 'star',                label: 'Star' },
  { name: 'flash-on',            label: 'Flash' },
  { name: 'music-note',          label: 'Music' },
  { name: 'palette',             label: 'Colors' },
  { name: 'waves',               label: 'Wave' },
  { name: 'blur-on',             label: 'Blur' },
  { name: 'gradient',            label: 'Fade' },
  { name: 'flare',               label: 'Flare' },
  { name: 'filter-drama',        label: 'Drama' },
  { name: 'lens',                label: 'Lens' },
  { name: 'colorize',            label: 'Drop' },
  { name: 'texture',             label: 'Texture' },
  { name: 'brightness-5',        label: 'Moon' },
  { name: 'brightness-7',        label: 'Bright' },
  { name: 'fiber-manual-record', label: 'Spot' },
  { name: 'star-border',         label: 'Ring' },
]

// Row height for drag-to-reorder modal
const ROW_H = 56

// ─────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────
export default function ControlScreen() {
  const router = useRouter()
  const tabBarHeight = useBottomTabBarHeight()
  const ambiances           = useAmbiancesStore((s) => s.ambiances)
  const categories          = useAmbiancesStore((s) => s.categories)
  const activeAmbianceId    = useAmbiancesStore((s) => s.activeAmbianceId)
  const activateAmbiance    = useAmbiancesStore((s) => s.activateAmbiance)
  const deactivateAll       = useAmbiancesStore((s) => s.deactivateAll)
  const addAmbiance         = useAmbiancesStore((s) => s.addAmbiance)
  const removeAmbiance      = useAmbiancesStore((s) => s.removeAmbiance)
  const renameAmbiance      = useAmbiancesStore((s) => s.renameAmbiance)
  const duplicateAmbiance   = useAmbiancesStore((s) => s.duplicateAmbiance)
  const setAmbianceIcon     = useAmbiancesStore((s) => s.setAmbianceIcon)
  const setAmbianceCategory = useAmbiancesStore((s) => s.setAmbianceCategory)
  const addCategory         = useAmbiancesStore((s) => s.addCategory)
  const removeCategory      = useAmbiancesStore((s) => s.removeCategory)
  const renameCategory      = useAmbiancesStore((s) => s.renameCategory)
  const reorderCategories   = useAmbiancesStore((s) => s.reorderCategories)

  // ── Create ambiance ────────────────────────────────────────
  const [newDialog,    setNewDialog]    = useState(false)
  const [nameInput,    setNameInput]    = useState('')
  const [newCatId,     setNewCatId]     = useState<string | undefined>()

  // ── Create category ────────────────────────────────────────
  const [catDialog,    setCatDialog]    = useState(false)
  const [catNameInput, setCatNameInput] = useState('')

  // ── FAB menu ───────────────────────────────────────────────
  const [fabMenuVisible, setFabMenuVisible] = useState(false)

  // ── Long-press ambiance ────────────────────────────────────
  const [longPressMenu, setLongPressMenu] = useState<string | null>(null)
  const [renameDialog,  setRenameDialog]  = useState<{ id: string; name: string } | null>(null)

  // ── Icon picker ────────────────────────────────────────────
  const [iconPickerFor, setIconPickerFor] = useState<string | null>(null)

  // ── Category picker (move ambiance) ───────────────────────
  const [catPickerFor, setCatPickerFor] = useState<string | null>(null)

  // ── Category options menu ──────────────────────────────────
  const [catMenu,         setCatMenu]         = useState<string | null>(null)
  const [renameCatDialog, setRenameCatDialog] = useState<{ id: string; name: string } | null>(null)

  // ── Category reorder modal ─────────────────────────────────
  const [reorderVisible, setReorderVisible] = useState(false)

  // ─── grouping ──────────────────────────────────────────────
  const validCatIds = new Set(categories.map((c) => c.id))
  const grouped = categories.map((cat) => ({
    category: cat,
    items: ambiances.filter((a) => a.categoryId === cat.id),
  }))
  const uncategorized = ambiances.filter(
    (a) => !a.categoryId || !validCatIds.has(a.categoryId),
  )

  const menuAmbiance = ambiances.find((a) => a.id === longPressMenu)

  function handleCardPress(id: string) {
    activeAmbianceId === id ? deactivateAll() : activateAmbiance(id)
  }

  function confirmCreate() {
    if (!nameInput.trim()) return
    const id = addAmbiance(nameInput.trim(), newCatId)
    setNameInput('')
    setNewDialog(false)
    router.push({ pathname: '/(tabs)/editor', params: { ambianceId: id } })
  }

  function confirmCreateCategory() {
    if (!catNameInput.trim()) return
    addCategory(catNameInput.trim())
    setCatNameInput('')
    setCatDialog(false)
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <BlackoutButton />

        {/* ── Fade controls ── */}
        <View style={styles.fadeRow}>
          <Pressable style={styles.fadeBtn}
            onPress={() => effectsRunner.startSlot({
              id: 'fade-in-manual', presetId: 'ramp_up',
              targetLightIds: 'all', bpm: 20, repeat: false, durationMs: 3000, maxIntensity: 100,
            })}>
            <MaterialIcons name="trending-up" size={18} color="#ff6b35" />
            <Text style={styles.fadeBtnLabel}>Fade In</Text>
          </Pressable>
          <Pressable style={styles.fadeBtn}
            onPress={() => effectsRunner.startSlot({
              id: 'fade-out-manual', presetId: 'ramp_down',
              targetLightIds: 'all', bpm: 20, repeat: false, durationMs: 3000, maxIntensity: 100,
            })}>
            <MaterialIcons name="trending-down" size={18} color="#aaa" />
            <Text style={[styles.fadeBtnLabel, { color: '#aaa' }]}>Fade Out</Text>
          </Pressable>
        </View>

        {/* ── Category sections ── */}
        {grouped.map(({ category, items }) => (
          <View key={category.id}>
            <CategoryHeader
              category={category}
              onLongPress={() => setCatMenu(category.id)}
            />
            {items.length === 0 ? (
              <Text style={styles.emptyCategory}>No ambiances yet</Text>
            ) : (
              <View style={styles.grid}>
                {items.map((amb) => (
                  <View key={amb.id} style={styles.cardWrapper}>
                    <AmbianceCard
                      ambiance={amb}
                      isActive={activeAmbianceId === amb.id}
                      onPress={() => handleCardPress(amb.id)}
                      onLongPress={() => setLongPressMenu(amb.id)}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* ── Uncategorized ── */}
        {uncategorized.length > 0 && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>OTHER</Text>
            </View>
            <View style={styles.grid}>
              {uncategorized.map((amb) => (
                <View key={amb.id} style={styles.cardWrapper}>
                  <AmbianceCard
                    ambiance={amb}
                    isActive={activeAmbianceId === amb.id}
                    onPress={() => handleCardPress(amb.id)}
                    onLongPress={() => setLongPressMenu(amb.id)}
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── FAB ── */}
      <Portal>
        <FAB
          icon="plus"
          style={[styles.fab, { bottom: tabBarHeight + 16 }]}
          color="#ffffff"
          onPress={() => setFabMenuVisible(true)}
        />
      </Portal>

      {/* ── FAB create menu ── */}
      <Portal>
        <Dialog visible={fabMenuVisible} onDismiss={() => setFabMenuVisible(false)}>
          <Dialog.Title>Create</Dialog.Title>
          <Dialog.Content>
            <View style={styles.menuOptions}>
              <Button
                icon="lightbulb-on-outline"
                mode="text"
                onPress={() => {
                  setFabMenuVisible(false)
                  setNewCatId(undefined)
                  setNameInput('')
                  setNewDialog(true)
                }}
              >New Ambiance</Button>
              <Button
                icon="folder-plus-outline"
                mode="text"
                onPress={() => {
                  setFabMenuVisible(false)
                  setCatNameInput('')
                  setCatDialog(true)
                }}
              >New Category</Button>
              <Button
                icon="sort"
                mode="text"
                onPress={() => {
                  setFabMenuVisible(false)
                  setReorderVisible(true)
                }}
              >Reorder Categories</Button>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setFabMenuVisible(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── New ambiance ── */}
      <Portal>
        <Dialog visible={newDialog} onDismiss={() => setNewDialog(false)}>
          <Dialog.Title>New Ambiance</Dialog.Title>
          <Dialog.Content style={{ gap: 12 }}>
            <TextInput
              label="Ambiance Name"
              value={nameInput}
              onChangeText={setNameInput}
              mode="outlined"
              autoFocus
              placeholder="e.g. Blue Wash, Party Mode…"
            />
            <View>
              <Text style={styles.pickerLabel}>Category (optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catChips}>
                <TouchableOpacity
                  style={[styles.catChip, !newCatId && styles.catChipActive]}
                  onPress={() => setNewCatId(undefined)}
                >
                  <Text style={[styles.catChipText, !newCatId && styles.catChipTextActive]}>None</Text>
                </TouchableOpacity>
                {categories.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.catChip, newCatId === c.id && styles.catChipActive]}
                    onPress={() => setNewCatId(c.id)}
                  >
                    <Text style={[styles.catChipText, newCatId === c.id && styles.catChipTextActive]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setNewDialog(false)}>Cancel</Button>
            <Button onPress={confirmCreate} disabled={!nameInput.trim()}>Create & Edit</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── New category ── */}
      <Portal>
        <Dialog visible={catDialog} onDismiss={() => setCatDialog(false)}>
          <Dialog.Title>New Category</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Category Name"
              value={catNameInput}
              onChangeText={setCatNameInput}
              mode="outlined"
              autoFocus
              placeholder="e.g. Show, Rehearsal…"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCatDialog(false)}>Cancel</Button>
            <Button onPress={confirmCreateCategory} disabled={!catNameInput.trim()}>Create</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── Ambiance long-press options ── */}
      <Portal>
        <Dialog visible={!!longPressMenu} onDismiss={() => setLongPressMenu(null)}>
          <Dialog.Title>{menuAmbiance?.name ?? ''}</Dialog.Title>
          <Dialog.Content>
            <View style={styles.menuOptions}>
              <Button icon="pencil" mode="text"
                onPress={() => {
                  router.push({ pathname: '/(tabs)/editor', params: { ambianceId: longPressMenu! } })
                  setLongPressMenu(null)
                }}
              >Edit Colors</Button>
              <Button icon="rename-box" mode="text"
                onPress={() => {
                  setRenameDialog({ id: longPressMenu!, name: menuAmbiance?.name ?? '' })
                  setLongPressMenu(null)
                }}
              >Rename</Button>
              <Button icon="image" mode="text"
                onPress={() => { setIconPickerFor(longPressMenu!); setLongPressMenu(null) }}
              >Change Icon</Button>
              <Button icon="folder-move-outline" mode="text"
                onPress={() => { setCatPickerFor(longPressMenu!); setLongPressMenu(null) }}
              >Move to Category</Button>
              <Button icon="content-copy" mode="text"
                onPress={() => { duplicateAmbiance(longPressMenu!); setLongPressMenu(null) }}
              >Duplicate</Button>
              <Button icon="delete" mode="text" textColor="#e74c3c"
                onPress={() => { removeAmbiance(longPressMenu!); setLongPressMenu(null) }}
              >Delete</Button>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setLongPressMenu(null)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── Rename ambiance ── */}
      <Portal>
        <Dialog visible={!!renameDialog} onDismiss={() => setRenameDialog(null)}>
          <Dialog.Title>Rename Ambiance</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Name"
              value={renameDialog?.name ?? ''}
              onChangeText={(t) => setRenameDialog((d) => d ? { ...d, name: t } : null)}
              mode="outlined"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRenameDialog(null)}>Cancel</Button>
            <Button
              onPress={() => {
                if (renameDialog) { renameAmbiance(renameDialog.id, renameDialog.name); setRenameDialog(null) }
              }}
            >Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── Icon picker ── */}
      <Portal>
        <Dialog visible={!!iconPickerFor} onDismiss={() => setIconPickerFor(null)}>
          <Dialog.Title>Choose Icon</Dialog.Title>
          <Dialog.Content>
            <View style={styles.iconGrid}>
              <TouchableOpacity
                style={styles.iconOption}
                onPress={() => { if (iconPickerFor) setAmbianceIcon(iconPickerFor, null); setIconPickerFor(null) }}
              >
                <MaterialIcons name="block" size={28} color="#555" />
                <Text style={styles.iconLabel}>None</Text>
              </TouchableOpacity>
              {AMBIANCE_ICONS.map((ic) => (
                <TouchableOpacity
                  key={ic.name}
                  style={styles.iconOption}
                  onPress={() => { if (iconPickerFor) setAmbianceIcon(iconPickerFor, ic.name); setIconPickerFor(null) }}
                >
                  <MaterialIcons name={ic.name as any} size={28} color="#ccc" />
                  <Text style={styles.iconLabel}>{ic.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIconPickerFor(null)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── Move to category picker ── */}
      <Portal>
        <Dialog visible={!!catPickerFor} onDismiss={() => setCatPickerFor(null)}>
          <Dialog.Title>Move to Category</Dialog.Title>
          <Dialog.Content>
            <View style={styles.menuOptions}>
              <Button mode="text"
                onPress={() => { if (catPickerFor) setAmbianceCategory(catPickerFor, null); setCatPickerFor(null) }}
              >No Category</Button>
              {categories.map((c) => (
                <Button key={c.id} mode="text"
                  onPress={() => { if (catPickerFor) setAmbianceCategory(catPickerFor, c.id); setCatPickerFor(null) }}
                >{c.name}</Button>
              ))}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCatPickerFor(null)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── Category long-press options ── */}
      <Portal>
        <Dialog visible={!!catMenu} onDismiss={() => setCatMenu(null)}>
          <Dialog.Title>{categories.find((c) => c.id === catMenu)?.name ?? ''}</Dialog.Title>
          <Dialog.Content>
            <View style={styles.menuOptions}>
              <Button icon="rename-box" mode="text"
                onPress={() => {
                  const cat = categories.find((c) => c.id === catMenu)
                  if (cat) setRenameCatDialog({ id: cat.id, name: cat.name })
                  setCatMenu(null)
                }}
              >Rename Category</Button>
              <Button icon="lightbulb-on-outline" mode="text"
                onPress={() => {
                  setNewCatId(catMenu ?? undefined)
                  setNameInput('')
                  setCatMenu(null)
                  setNewDialog(true)
                }}
              >Add Ambiance Here</Button>
              <Button icon="sort" mode="text"
                onPress={() => { setCatMenu(null); setReorderVisible(true) }}
              >Reorder All Categories</Button>
              <Button icon="delete" mode="text" textColor="#e74c3c"
                onPress={() => { if (catMenu) removeCategory(catMenu); setCatMenu(null) }}
              >Delete Category</Button>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCatMenu(null)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── Rename category ── */}
      <Portal>
        <Dialog visible={!!renameCatDialog} onDismiss={() => setRenameCatDialog(null)}>
          <Dialog.Title>Rename Category</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Name"
              value={renameCatDialog?.name ?? ''}
              onChangeText={(t) => setRenameCatDialog((d) => d ? { ...d, name: t } : null)}
              mode="outlined"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRenameCatDialog(null)}>Cancel</Button>
            <Button
              onPress={() => {
                if (renameCatDialog) {
                  renameCategory(renameCatDialog.id, renameCatDialog.name)
                  setRenameCatDialog(null)
                }
              }}
            >Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── Category reorder modal ── */}
      <ReorderCategoriesModal
        visible={reorderVisible}
        categories={categories}
        onCommit={reorderCategories}
        onClose={() => setReorderVisible(false)}
      />

      <EffectsBar />
    </SafeAreaView>
  )
}

// ─────────────────────────────────────────────────────────────
// Category section header
// ─────────────────────────────────────────────────────────────
function CategoryHeader({
  category, onLongPress,
}: { category: AmbianceCategory; onLongPress: () => void }) {
  return (
    <TouchableOpacity style={styles.sectionHeader} onLongPress={onLongPress} activeOpacity={0.7}>
      <Text style={styles.sectionTitle}>{category.name.toUpperCase()}</Text>
      <Text style={styles.sectionHint}>Long press for options</Text>
    </TouchableOpacity>
  )
}

// ─────────────────────────────────────────────────────────────
// Drag-to-reorder modal
// ─────────────────────────────────────────────────────────────
function ReorderCategoriesModal({
  visible, categories, onCommit, onClose,
}: {
  visible: boolean
  categories: AmbianceCategory[]
  onCommit: (orderedIds: string[]) => void
  onClose: () => void
}) {
  const [localOrder, setLocalOrder] = useState<AmbianceCategory[]>([])
  const dragFromIndex = useSharedValue(-1)
  const dragY        = useSharedValue(0)

  useEffect(() => {
    if (visible) setLocalOrder([...categories])
  }, [visible]) // snapshot on open only

  function handleCommit(from: number, rawY: number) {
    const total = localOrder.length
    const to = Math.max(0, Math.min(total - 1, Math.round(rawY / ROW_H)))
    if (from !== to) {
      setLocalOrder((prev) => {
        const next = [...prev]
        const [item] = next.splice(from, 1)
        next.splice(to, 0, item)
        return next
      })
    }
    dragFromIndex.value = -1
  }

  function handleDone() {
    onCommit(localOrder.map((c) => c.id))
    onClose()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={reorderStyles.overlay}>
        <View style={reorderStyles.sheet}>
          <Text style={reorderStyles.title}>Reorder Categories</Text>
          <Text style={reorderStyles.hint}>Hold  ≡  and drag to reorder</Text>

          <View style={{ height: localOrder.length * ROW_H, marginVertical: 16 }}>
            {localOrder.map((cat, i) => (
              <DraggableRow
                key={cat.id}
                category={cat}
                index={i}
                total={localOrder.length}
                dragFromIndex={dragFromIndex}
                dragY={dragY}
                onCommit={handleCommit}
              />
            ))}
          </View>

          <View style={reorderStyles.actions}>
            <Button mode="outlined" onPress={onClose} style={{ flex: 1 }}>Cancel</Button>
            <Button mode="contained" onPress={handleDone} style={{ flex: 1 }}>Done</Button>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────
// Single draggable row inside the reorder modal
// ─────────────────────────────────────────────────────────────
function DraggableRow({
  category, index, total, dragFromIndex, dragY, onCommit,
}: {
  category: AmbianceCategory
  index: number
  total: number
  dragFromIndex: SharedValue<number>
  dragY: SharedValue<number>
  onCommit: (from: number, rawY: number) => void
}) {
  const pan = Gesture.Pan()
    .activateAfterLongPress(220)
    .onBegin(() => {
      dragFromIndex.value = index
      dragY.value = index * ROW_H
    })
    .onUpdate((e) => {
      dragY.value = Math.max(0, Math.min((total - 1) * ROW_H, index * ROW_H + e.translationY))
    })
    .onEnd(() => {
      runOnJS(onCommit)(index, dragY.value)
    })

  const animStyle = useAnimatedStyle(() => {
    const from = dragFromIndex.value

    if (from < 0) {
      return {
        position: 'absolute' as const,
        top: index * ROW_H, left: 0, right: 0,
        zIndex: 1, opacity: 1,
        transform: [{ translateY: 0 }],
      }
    }

    const to = Math.max(0, Math.min(total - 1, Math.round(dragY.value / ROW_H)))

    if (index === from) {
      return {
        position: 'absolute' as const,
        top: index * ROW_H, left: 0, right: 0,
        zIndex: 10, opacity: 0.92,
        transform: [{ translateY: dragY.value - index * ROW_H }],
      }
    }

    let shift = 0
    if (from < to && index > from && index <= to) shift = -ROW_H
    else if (from > to && index >= to && index < from) shift = ROW_H

    return {
      position: 'absolute' as const,
      top: index * ROW_H, left: 0, right: 0,
      zIndex: 1, opacity: 1,
      transform: [{ translateY: shift }],
    }
  })

  return (
    <Animated.View style={animStyle}>
      <View style={reorderStyles.row}>
        <GestureDetector gesture={pan}>
          <View style={reorderStyles.handle}>
            <MaterialIcons name="drag-handle" size={24} color="#777" />
          </View>
        </GestureDetector>
        <Text style={reorderStyles.rowText}>{category.name}</Text>
      </View>
    </Animated.View>
  )
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: '#0a0a0a' },
  scroll:         { flex: 1 },
  content:        { paddingTop: 8 },
  sectionHeader: {
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
  },
  sectionTitle:   { fontSize: 11, fontWeight: '700', color: '#555', letterSpacing: 1.5 },
  sectionHint:    { fontSize: 10, color: '#444' },
  emptyCategory:  { fontSize: 12, color: '#333', paddingHorizontal: 22, paddingBottom: 8, fontStyle: 'italic' },
  grid:           { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10 },
  cardWrapper:    { width: '50%' },
  fadeRow:     { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 12 },
  fadeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#141414', borderRadius: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  fadeBtnLabel: { fontSize: 13, fontWeight: '600', color: '#ff6b35' },
  fab:            { position: 'absolute', right: 20, backgroundColor: '#ff6b35' },
  menuOptions:    { gap: 4 },
  pickerLabel:    { fontSize: 12, color: '#888', marginBottom: 6 },
  catChips:       { flexDirection: 'row' },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 16, backgroundColor: '#252525', marginRight: 8,
    borderWidth: 1, borderColor: '#333',
  },
  catChipActive:      { backgroundColor: '#ff6b35', borderColor: '#ff6b35' },
  catChipText:        { fontSize: 13, color: '#aaa' },
  catChipTextActive:  { color: '#fff', fontWeight: '700' },
  iconGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4,
  },
  iconOption: {
    width: 56, alignItems: 'center', gap: 4,
    paddingVertical: 8, borderRadius: 10, backgroundColor: '#1e1e1e',
  },
  iconLabel: { fontSize: 9, color: '#888', textAlign: 'center' },
})

const reorderStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  title:  { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  hint:   { color: '#555', fontSize: 12 },
  row: {
    height: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 10,
    marginBottom: 2,
  },
  handle:  { padding: 8 },
  rowText: { color: '#ddd', fontSize: 16, flex: 1 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
})
