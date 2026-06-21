import React from 'react'
import { StyleSheet, View, Pressable } from 'react-native'
import { Text } from 'react-native-paper'
import { MaterialIcons } from '@expo/vector-icons'
import { useFixturesStore, type Category, type Fixture } from '../store/fixturesStore'
import { LightCard } from './LightCard'

interface Props {
  category: Category
  fixtures: Fixture[]
  onFixtureLongPress: (fixture: Fixture) => void
}

export function CategoryFolder({ category, fixtures, onFixtureLongPress }: Props) {
  const toggleCategoryExpanded = useFixturesStore((s) => s.toggleCategoryExpanded)

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.header}
        onPress={() => toggleCategoryExpanded(category.id)}
      >
        <Text style={styles.title}>{category.name}</Text>
        <MaterialIcons
          name={category.isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          size={22}
          color="#aaaaaa"
        />
      </Pressable>

      {category.isExpanded && (
        <View style={styles.grid}>
          {fixtures.map((fixture) => (
            <View key={fixture.id} style={styles.cardWrapper}>
              <LightCard
                fixture={fixture}
                onLongPress={() => onFixtureLongPress(fixture)}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 10,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#aaaaaa',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cardWrapper: {
    width: '50%',
  },
})
