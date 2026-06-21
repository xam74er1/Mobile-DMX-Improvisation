import React, { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { FAB, Portal, Dialog, TextInput, Button, Text, RadioButton } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { BlackoutButton } from '../../src/components/BlackoutButton'
import { CategoryFolder } from '../../src/components/CategoryFolder'
import { useFixturesStore, type Fixture } from '../../src/store/fixturesStore'
import { useSceneStore } from '../../src/store/sceneStore'

export default function ControlScreen() {
  const router = useRouter()
  const fixtures = useFixturesStore((s) => s.fixtures)
  const categories = useFixturesStore((s) => s.categories)
  const addFixture = useFixturesStore((s) => s.addFixture)
  const addCategory = useFixturesStore((s) => s.addCategory)
  const selectFixture = useSceneStore((s) => s.selectFixture)

  const [fabOpen, setFabOpen] = useState(false)
  const [addDialog, setAddDialog] = useState<'fixture' | 'category' | null>(null)
  const [nameInput, setNameInput] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')

  function handleFixtureLongPress(fixture: Fixture) {
    selectFixture(fixture.id)
    router.push('/(tabs)/editor')
  }

  function openAddFixture() {
    setNameInput('')
    setSelectedCategoryId(categories[0]?.id ?? '')
    setAddDialog('fixture')
    setFabOpen(false)
  }

  function openAddCategory() {
    setNameInput('')
    setAddDialog('category')
    setFabOpen(false)
  }

  function confirmAdd() {
    if (!nameInput.trim()) return
    if (addDialog === 'fixture') {
      addFixture(nameInput.trim(), 1, 'RGB', selectedCategoryId || (categories[0]?.id ?? ''))
    } else {
      addCategory(nameInput.trim())
    }
    setAddDialog(null)
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <BlackoutButton />

        {categories.map((cat) => {
          const catFixtures = fixtures.filter((f) => f.categoryId === cat.id)
          return (
            <CategoryFolder
              key={cat.id}
              category={cat}
              fixtures={catFixtures}
              onFixtureLongPress={handleFixtureLongPress}
            />
          )
        })}

        {/* Bottom padding for FAB */}
        <View style={{ height: 80 }} />
      </ScrollView>

      <Portal>
        <FAB.Group
          open={fabOpen}
          icon={fabOpen ? 'close' : 'plus'}
          actions={[
            {
              icon: 'lightbulb-outline',
              label: 'Add Light',
              onPress: openAddFixture,
            },
            {
              icon: 'folder-plus',
              label: 'Add Category',
              onPress: openAddCategory,
            },
          ]}
          onStateChange={({ open }) => setFabOpen(open)}
          fabStyle={styles.fab}
          color="#ffffff"
        />
      </Portal>

      {/* Add dialog */}
      <Portal>
        <Dialog visible={addDialog !== null} onDismiss={() => setAddDialog(null)}>
          <Dialog.Title>
            {addDialog === 'fixture' ? 'Add Light' : 'Add Category'}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Name"
              value={nameInput}
              onChangeText={setNameInput}
              mode="outlined"
              autoFocus
            />
            {addDialog === 'fixture' && categories.length > 0 && (
              <View style={styles.categoryPicker}>
                <Text style={styles.categoryLabel}>Category</Text>
                <RadioButton.Group
                  value={selectedCategoryId}
                  onValueChange={setSelectedCategoryId}
                >
                  {categories.map((cat) => (
                    <RadioButton.Item
                      key={cat.id}
                      label={cat.name}
                      value={cat.id}
                      labelStyle={styles.radioLabel}
                    />
                  ))}
                </RadioButton.Group>
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAddDialog(null)}>Cancel</Button>
            <Button onPress={confirmAdd} disabled={!nameInput.trim()}>
              Add
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
  fab: {
    backgroundColor: '#ff6b35',
  },
  categoryPicker: {
    marginTop: 12,
  },
  categoryLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  radioLabel: {
    color: '#ffffff',
  },
})
