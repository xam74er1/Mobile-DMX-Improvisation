import React, { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { FAB, Portal, Dialog, TextInput, Button, Text } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BlackoutButton } from '../../src/components/BlackoutButton'
import { AmbianceCard } from '../../src/components/AmbianceCard'
import { useAmbiancesStore } from '../../src/store/ambiancesStore'
import { useRouter } from 'expo-router'

export default function ControlScreen() {
  const router = useRouter()
  const ambiances = useAmbiancesStore((s) => s.ambiances)
  const activeAmbianceId = useAmbiancesStore((s) => s.activeAmbianceId)
  const activateAmbiance = useAmbiancesStore((s) => s.activateAmbiance)
  const deactivateAll = useAmbiancesStore((s) => s.deactivateAll)
  const addAmbiance = useAmbiancesStore((s) => s.addAmbiance)

  const [newDialog, setNewDialog] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [longPressMenu, setLongPressMenu] = useState<string | null>(null)
  const removeAmbiance = useAmbiancesStore((s) => s.removeAmbiance)
  const renameAmbiance = useAmbiancesStore((s) => s.renameAmbiance)
  const duplicateAmbiance = useAmbiancesStore((s) => s.duplicateAmbiance)
  const [renameDialog, setRenameDialog] = useState<{ id: string; name: string } | null>(null)

  function handleCardPress(id: string) {
    if (activeAmbianceId === id) {
      deactivateAll()
    } else {
      activateAmbiance(id)
    }
  }

  function handleCardLongPress(id: string) {
    setLongPressMenu(id)
  }

  function confirmCreate() {
    if (!nameInput.trim()) return
    const id = addAmbiance(nameInput.trim())
    setNameInput('')
    setNewDialog(false)
    // Navigate to editor with this new ambiance pre-selected
    router.push({ pathname: '/(tabs)/editor', params: { ambianceId: id } })
  }

  const menuAmbiance = ambiances.find((a) => a.id === longPressMenu)

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <BlackoutButton />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>AMBIANCES</Text>
          <Text style={styles.sectionHint}>Tap to activate · Long press for options</Text>
        </View>

        <View style={styles.grid}>
          {ambiances.map((amb) => (
            <View key={amb.id} style={styles.cardWrapper}>
              <AmbianceCard
                ambiance={amb}
                isActive={activeAmbianceId === amb.id}
                onPress={() => handleCardPress(amb.id)}
                onLongPress={() => handleCardLongPress(amb.id)}
              />
            </View>
          ))}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB to add ambiance */}
      <Portal>
        <FAB
          icon="plus"
          style={styles.fab}
          color="#ffffff"
          onPress={() => {
            setNameInput('')
            setNewDialog(true)
          }}
        />
      </Portal>

      {/* New ambiance dialog */}
      <Portal>
        <Dialog visible={newDialog} onDismiss={() => setNewDialog(false)}>
          <Dialog.Title>New Ambiance</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Ambiance Name"
              value={nameInput}
              onChangeText={setNameInput}
              mode="outlined"
              autoFocus
              placeholder="e.g. Blue Wash, Party Mode…"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setNewDialog(false)}>Cancel</Button>
            <Button onPress={confirmCreate} disabled={!nameInput.trim()}>
              Create & Edit
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Long-press options dialog */}
      <Portal>
        <Dialog
          visible={!!longPressMenu}
          onDismiss={() => setLongPressMenu(null)}
        >
          <Dialog.Title>{menuAmbiance?.name ?? ''}</Dialog.Title>
          <Dialog.Content>
            <View style={styles.menuOptions}>
              <Button
                icon="pencil"
                mode="text"
                onPress={() => {
                  router.push({
                    pathname: '/(tabs)/editor',
                    params: { ambianceId: longPressMenu! },
                  })
                  setLongPressMenu(null)
                }}
              >
                Edit Colors
              </Button>
              <Button
                icon="rename-box"
                mode="text"
                onPress={() => {
                  setRenameDialog({ id: longPressMenu!, name: menuAmbiance?.name ?? '' })
                  setLongPressMenu(null)
                }}
              >
                Rename
              </Button>
              <Button
                icon="content-copy"
                mode="text"
                onPress={() => {
                  duplicateAmbiance(longPressMenu!)
                  setLongPressMenu(null)
                }}
              >
                Duplicate
              </Button>
              <Button
                icon="delete"
                mode="text"
                textColor="#e74c3c"
                onPress={() => {
                  removeAmbiance(longPressMenu!)
                  setLongPressMenu(null)
                }}
              >
                Delete
              </Button>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setLongPressMenu(null)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Rename dialog */}
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
                if (renameDialog) {
                  renameAmbiance(renameDialog.id, renameDialog.name)
                  setRenameDialog(null)
                }
              }}
            >
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 8,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555',
    letterSpacing: 1.5,
  },
  sectionHint: {
    fontSize: 10,
    color: '#444',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
  },
  cardWrapper: {
    width: '50%',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    backgroundColor: '#ff6b35',
  },
  menuOptions: {
    gap: 4,
  },
})
