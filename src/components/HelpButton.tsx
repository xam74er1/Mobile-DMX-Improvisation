import React, { useState } from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import { Text, IconButton, Portal, Dialog, Button } from 'react-native-paper'
import { useTranslation } from 'react-i18next'

export type HelpSection = 'control' | 'editor' | 'network' | 'lights' | 'backup' | 'troubleshooting'

interface Props {
  section: HelpSection
  /** Icon color — defaults to the muted grey used for secondary chrome. */
  color?: string
}

// Small "(?)" button dropped into a screen's header. Opens the exact same
// title/intro/points content used by that section's card in the Tutorial
// tab (Settings → Tutorial) — single source of truth in the locale files,
// so contextual help never drifts out of sync with the full guide.
export function HelpButton({ section, color = '#666' }: Props) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  const title = t(`settings.tutorial.sections.${section}.title`)
  const intro = t(`settings.tutorial.sections.${section}.intro`)
  const points = t(`settings.tutorial.sections.${section}.points`, { returnObjects: true }) as unknown as string[]

  return (
    <>
      <IconButton
        icon="help-circle-outline"
        size={20}
        iconColor={color}
        onPress={() => setVisible(true)}
        accessibilityLabel={t('settings.tutorial.help.buttonLabel')}
      />
      <Portal>
        <Dialog visible={visible} onDismiss={() => setVisible(false)} style={styles.dialog}>
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.ScrollArea style={styles.scrollArea}>
            <ScrollView>
              <Text style={styles.intro}>{intro}</Text>
              {Array.isArray(points) && points.map((p, i) => (
                <View key={i} style={styles.pointRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.pointText}>{p}</Text>
                </View>
              ))}
              <Text style={styles.seeMore}>{t('settings.tutorial.help.seeMore')}</Text>
              <View style={{ height: 4 }} />
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setVisible(false)}>{t('common.done')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  )
}

const styles = StyleSheet.create({
  dialog: { maxHeight: '80%' },
  scrollArea: { maxHeight: 420 },
  intro: { fontSize: 13, color: '#aaa', lineHeight: 19, marginBottom: 10 },
  pointRow: { flexDirection: 'row', gap: 8, marginBottom: 8, paddingRight: 4 },
  bullet: { color: '#ff6b35', fontSize: 14, lineHeight: 19 },
  pointText: { flex: 1, fontSize: 13, color: '#ddd', lineHeight: 19 },
  seeMore: { fontSize: 11, color: '#666', marginTop: 8, fontStyle: 'italic' },
})
