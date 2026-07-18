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
import { useTranslation } from 'react-i18next'
import { BlackoutButton } from '../../src/components/BlackoutButton'
import { HelpButton } from '../../src/components/HelpButton'
import { ConnectionStatusDot } from '../../src/components/ConnectionStatusDot'
import { AmbianceCard } from '../../src/components/AmbianceCard'
import { EffectsBar } from '../../src/components/EffectsBar'
import { useAmbiancesStore } from '../../src/store/ambiancesStore'
import type { AmbianceCategory } from '../../src/store/ambiancesStore'
import { useSettingsStore } from '../../src/store/settingsStore'
import Slider from '../../src/components/AppSlider'
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
  const { t } = useTranslation()
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
  const resendCurrent       = useAmbiancesStore((s) => s.resendCurrent)
  const setBlackout         = useAmbiancesStore((s) => s.setBlackout)

  const masterIntensity    = useSettingsStore((s) => s.masterIntensity)
  const setMasterIntensity = useSettingsStore((s) => s.setMasterIntensity)
  const fadeDurationMs     = useSettingsStore((s) => s.fadeDurationMs)
  const setFadeDurationMs  = useSettingsStore((s) => s.setFadeDurationMs)

  // ── Fade button running state (polled — effectsRunner isn't a store) ──
  const [fadeInActive, setFadeInActive] = useState(false)
  const [fadeOutActive, setFadeOutActive] = useState(false)
  useEffect(() => {
    const id = setInterval(() => {
      setFadeInActive(effectsRunner.isSlotRunning('fade-in-manual'))
      setFadeOutActive(effectsRunner.isSlotRunning('fade-out-manual'))
    }, 150)
    return () => clearInterval(id)
  }, [])

  // ── Fade duration picker (long-press either fade button) ──
  const [durationDialog, setDurationDialog] = useState(false)

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
        <View style={styles.helpRow}>
          <HelpButton section="control" />
        </View>
        <BlackoutButton />
        <ConnectionStatusDot />

        {/* ── Fade controls ── */}
        <View style={styles.fadeRow}>
          <Pressable
            style={[styles.fadeBtn, fadeInActive && styles.fadeBtnActive]}
            onLongPress={() => setDurationDialog(true)}
            onPress={() => {
              // Cancel an opposite fade in progress so the two never race.
              effectsRunner.stopSlot('fade-out-manual')
              // Clear blackout silently (no immediate full-brightness send) so
              // the ramp starts from black instead of flashing to 100%.
              useAmbiancesStore.setState({ blackout: false })
              effectsRunner.startSlot({
                id: 'fade-in-manual', presetId: 'ramp_up',
                targetLightIds: 'all', bpm: 20, repeat: false, durationMs: fadeDurationMs, maxIntensity: 100,
              })
            }}>
            <MaterialIcons name="trending-up" size={18} color={fadeInActive ? '#fff' : '#ff6b35'} />
            <Text style={[styles.fadeBtnLabel, fadeInActive && { color: '#fff' }]}>
              {fadeInActive ? t('panel1.fadingIn') : t('panel1.fadeIn')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.fadeBtn, fadeOutActive && styles.fadeBtnActive]}
            onLongPress={() => setDurationDialog(true)}
            onPress={() => {
              effectsRunner.stopSlot('fade-in-manual')
              effectsRunner.startSlot({
                id: 'fade-out-manual', presetId: 'ramp_down',
                targetLightIds: 'all', bpm: 20, repeat: false, durationMs: fadeDurationMs, maxIntensity: 100,
                // End of fade-out = real blackout: lights stay off and the main
                // button switches to its black state.
                onComplete: () => setBlackout(true),
              })
            }}>
            <MaterialIcons name="trending-down" size={18} color={fadeOutActive ? '#fff' : '#aaa'} />
            <Text style={[styles.fadeBtnLabel, { color: fadeOutActive ? '#fff' : '#aaa' }]}>
              {fadeOutActive ? t('panel1.fadingOut') : t('panel1.fadeOut')}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.fadeDurationHint}>{t('panel1.fadeDurationHint', { sec: (fadeDurationMs / 1000).toFixed(1) })}</Text>

        {/* ── Master intensity (global brightness cap) ── */}
        <View style={styles.masterRow}>
          <MaterialIcons name="brightness-6" size={16} color="#ff6b35" />
          <Slider
            style={styles.masterSlider}
            value={masterIntensity}
            onValueChange={(v: number) => {
              setMasterIntensity(v)
              // While an effect is running, its own 50ms tick already re-reads
              // masterIntensity fresh — resending here would race it with a
              // stale base-scene frame and cause a flicker.
              if (effectsRunner.activeIds.length === 0) resendCurrent()
            }}
            minimumValue={5}
            maximumValue={100}
            step={1}
            minimumTrackTintColor="#ff6b35"
            maximumTrackTintColor="#333"
            thumbTintColor="#ff6b35"
          />
          <Text style={styles.masterValue}>{masterIntensity}%</Text>
        </View>

        {/* ── Category sections ── */}
        {grouped.map(({ category, items }) => (
          <View key={category.id}>
            <CategoryHeader
              category={category}
              onLongPress={() => setCatMenu(category.id)}
            />
            {items.length === 0 ? (
              <Text style={styles.emptyCategory}>{t('panel1.noAmbiancesYet')}</Text>
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
              <Text style={styles.sectionTitle}>{t('panel1.other')}</Text>
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
          <Dialog.Title>{t('panel1.createDialogTitle')}</Dialog.Title>
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
              >{t('panel1.newAmbiance')}</Button>
              <Button
                icon="folder-plus-outline"
                mode="text"
                onPress={() => {
                  setFabMenuVisible(false)
                  setCatNameInput('')
                  setCatDialog(true)
                }}
              >{t('panel1.newCategory')}</Button>
              <Button
                icon="sort"
                mode="text"
                onPress={() => {
                  setFabMenuVisible(false)
                  setReorderVisible(true)
                }}
              >{t('panel1.reorderCategories')}</Button>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setFabMenuVisible(false)}>{t('common.cancel')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── New ambiance ── */}
      <Portal>
        <Dialog visible={newDialog} onDismiss={() => setNewDialog(false)}>
          <Dialog.Title>{t('panel1.newAmbiance')}</Dialog.Title>
          <Dialog.Content style={{ gap: 12 }}>
            <TextInput
              label={t('panel1.ambianceName')}
              value={nameInput}
              onChangeText={setNameInput}
              mode="outlined"
              autoFocus
              placeholder={t('panel1.ambianceNamePlaceholder')}
            />
            <View>
              <Text style={styles.pickerLabel}>{t('panel1.categoryOptional')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catChips}>
                <TouchableOpacity
                  style={[styles.catChip, !newCatId && styles.catChipActive]}
                  onPress={() => setNewCatId(undefined)}
                >
                  <Text style={[styles.catChipText, !newCatId && styles.catChipTextActive]}>{t('common.none')}</Text>
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
            <Button onPress={() => setNewDialog(false)}>{t('common.cancel')}</Button>
            <Button onPress={confirmCreate} disabled={!nameInput.trim()}>{t('panel1.createAndEdit')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── Fade duration picker (long-press Fade In/Out) ── */}
      <Portal>
        <Dialog visible={durationDialog} onDismiss={() => setDurationDialog(false)}>
          <Dialog.Title>{t('panel1.fadeDurationTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.pickerLabel}>{(fadeDurationMs / 1000).toFixed(1)}s</Text>
            <Slider
              value={fadeDurationMs}
              onValueChange={setFadeDurationMs}
              minimumValue={500}
              maximumValue={10000}
              step={250}
              minimumTrackTintColor="#ff6b35"
              maximumTrackTintColor="#333"
              thumbTintColor="#ff6b35"
              style={{ height: 36, marginTop: 4 }}
            />
            <Text style={styles.hint}>{t('panel1.fadeDurationHint2')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDurationDialog(false)}>{t('common.done')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── New category ── */}
      <Portal>
        <Dialog visible={catDialog} onDismiss={() => setCatDialog(false)}>
          <Dialog.Title>{t('panel1.newCategory')}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label={t('panel1.categoryName')}
              value={catNameInput}
              onChangeText={setCatNameInput}
              mode="outlined"
              autoFocus
              placeholder={t('panel1.categoryNamePlaceholder')}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCatDialog(false)}>{t('common.cancel')}</Button>
            <Button onPress={confirmCreateCategory} disabled={!catNameInput.trim()}>{t('common.create')}</Button>
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
              >{t('panel1.editColors')}</Button>
              <Button icon="rename-box" mode="text"
                onPress={() => {
                  setRenameDialog({ id: longPressMenu!, name: menuAmbiance?.name ?? '' })
                  setLongPressMenu(null)
                }}
              >{t('panel1.rename')}</Button>
              <Button icon="image" mode="text"
                onPress={() => { setIconPickerFor(longPressMenu!); setLongPressMenu(null) }}
              >{t('panel1.changeIcon')}</Button>
              <Button icon="folder-move-outline" mode="text"
                onPress={() => { setCatPickerFor(longPressMenu!); setLongPressMenu(null) }}
              >{t('panel1.moveToCategory')}</Button>
              <Button icon="content-copy" mode="text"
                onPress={() => { duplicateAmbiance(longPressMenu!); setLongPressMenu(null) }}
              >{t('panel1.duplicate')}</Button>
              <Button icon="delete" mode="text" textColor="#e74c3c"
                onPress={() => { removeAmbiance(longPressMenu!); setLongPressMenu(null) }}
              >{t('common.delete')}</Button>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setLongPressMenu(null)}>{t('common.cancel')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── Rename ambiance ── */}
      <Portal>
        <Dialog visible={!!renameDialog} onDismiss={() => setRenameDialog(null)}>
          <Dialog.Title>{t('panel1.renameAmbianceTitle')}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label={t('panel1.name')}
              value={renameDialog?.name ?? ''}
              onChangeText={(v) => setRenameDialog((d) => d ? { ...d, name: v } : null)}
              mode="outlined"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRenameDialog(null)}>{t('common.cancel')}</Button>
            <Button
              onPress={() => {
                if (renameDialog) { renameAmbiance(renameDialog.id, renameDialog.name); setRenameDialog(null) }
              }}
            >{t('common.save')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── Icon picker ── */}
      <Portal>
        <Dialog visible={!!iconPickerFor} onDismiss={() => setIconPickerFor(null)}>
          <Dialog.Title>{t('panel1.chooseIcon')}</Dialog.Title>
          <Dialog.Content>
            <View style={styles.iconGrid}>
              <TouchableOpacity
                style={styles.iconOption}
                onPress={() => { if (iconPickerFor) setAmbianceIcon(iconPickerFor, null); setIconPickerFor(null) }}
              >
                <MaterialIcons name="block" size={28} color="#555" />
                <Text style={styles.iconLabel}>{t('common.none')}</Text>
              </TouchableOpacity>
              {AMBIANCE_ICONS.map((ic) => (
                <TouchableOpacity
                  key={ic.name}
                  style={styles.iconOption}
                  onPress={() => { if (iconPickerFor) setAmbianceIcon(iconPickerFor, ic.name); setIconPickerFor(null) }}
                >
                  <MaterialIcons name={ic.name as any} size={28} color="#ccc" />
                  <Text style={styles.iconLabel}>{t(`panel1.icon.${ic.label}`)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIconPickerFor(null)}>{t('common.cancel')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── Move to category picker ── */}
      <Portal>
        <Dialog visible={!!catPickerFor} onDismiss={() => setCatPickerFor(null)}>
          <Dialog.Title>{t('panel1.moveToCategory')}</Dialog.Title>
          <Dialog.Content>
            <View style={styles.menuOptions}>
              <Button mode="text"
                onPress={() => { if (catPickerFor) setAmbianceCategory(catPickerFor, null); setCatPickerFor(null) }}
              >{t('panel1.noCategory')}</Button>
              {categories.map((c) => (
                <Button key={c.id} mode="text"
                  onPress={() => { if (catPickerFor) setAmbianceCategory(catPickerFor, c.id); setCatPickerFor(null) }}
                >{c.name}</Button>
              ))}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCatPickerFor(null)}>{t('common.cancel')}</Button>
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
              >{t('panel1.renameCategoryMenu')}</Button>
              <Button icon="lightbulb-on-outline" mode="text"
                onPress={() => {
                  setNewCatId(catMenu ?? undefined)
                  setNameInput('')
                  setCatMenu(null)
                  setNewDialog(true)
                }}
              >{t('panel1.addAmbianceHere')}</Button>
              <Button icon="sort" mode="text"
                onPress={() => { setCatMenu(null); setReorderVisible(true) }}
              >{t('panel1.reorderAllCategories')}</Button>
              <Button icon="delete" mode="text" textColor="#e74c3c"
                onPress={() => { if (catMenu) removeCategory(catMenu); setCatMenu(null) }}
              >{t('panel1.deleteCategory')}</Button>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCatMenu(null)}>{t('common.cancel')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* ── Rename category ── */}
      <Portal>
        <Dialog visible={!!renameCatDialog} onDismiss={() => setRenameCatDialog(null)}>
          <Dialog.Title>{t('panel1.renameCategoryTitle')}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label={t('panel1.name')}
              value={renameCatDialog?.name ?? ''}
              onChangeText={(v) => setRenameCatDialog((d) => d ? { ...d, name: v } : null)}
              mode="outlined"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRenameCatDialog(null)}>{t('common.cancel')}</Button>
            <Button
              onPress={() => {
                if (renameCatDialog) {
                  renameCategory(renameCatDialog.id, renameCatDialog.name)
                  setRenameCatDialog(null)
                }
              }}
            >{t('common.save')}</Button>
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
  const { t } = useTranslation()
  return (
    <TouchableOpacity style={styles.sectionHeader} onLongPress={onLongPress} activeOpacity={0.7}>
      <Text style={styles.sectionTitle}>{category.name.toUpperCase()}</Text>
      <Text style={styles.sectionHint}>{t('panel1.longPressForOptions')}</Text>
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
  const { t } = useTranslation()
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
          <Text style={reorderStyles.title}>{t('panel1.reorderCategoriesTitle')}</Text>
          <Text style={reorderStyles.hint}>{t('panel1.reorderHint')}</Text>

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
            <Button mode="outlined" onPress={onClose} style={{ flex: 1 }}>{t('common.cancel')}</Button>
            <Button mode="contained" onPress={handleDone} style={{ flex: 1 }}>{t('common.done')}</Button>
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
  helpRow:        { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 8 },
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
  fadeBtnActive: { backgroundColor: '#ff6b35', borderColor: '#ff6b35' },
  fadeDurationHint: { fontSize: 10, color: '#444', marginHorizontal: 16, marginTop: -6, marginBottom: 10 },
  hint: { color: '#555', fontSize: 12, marginTop: 6 },
  masterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#141414', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  masterSlider: { flex: 1, height: 32 },
  masterValue: { fontSize: 12, fontWeight: '600', color: '#ff6b35', width: 40, textAlign: 'right' },
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
