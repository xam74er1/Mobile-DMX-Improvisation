# Mobile DMX Improvisator

🇬🇧 [English version](README.md)

Une application mobile pour piloter des lumières DMX en temps réel via l'interface WiFi **Eurolite FreeDMX AP** (Art-Net sur UDP).

Fonctionne sur **Android** (contrôle DMX complet), **iOS** (contrôle DMX complet) et **Web** (aperçu de l'interface uniquement — pas d'UDP).

---

## C'est quoi ?

**DMX Improvisator** transforme votre téléphone en console lumière. Connectez-vous au WiFi du boîtier Eurolite FreeDMX AP et pilotez vos projecteurs DMX (pars LED, etc.) en direct : touchez une ambiance pour éclairer la salle, faites des fondus, lancez un stroboscope ou ajustez les couleurs à la volée. Conçue pour les spectacles : assez simple pour un opérateur non technicien, assez souple pour configurer chaque projecteur.

### Captures d'écran

| Contrôle (mode show) | Éditeur de lumière | Réglages |
|---|---|---|
| ![Panneau de contrôle](docs/screenshots/control.png) | ![Éditeur](docs/screenshots/editor.png) | ![Réglages](docs/screenshots/settings.png) |

### Utilisation rapide

1. Connectez le téléphone au WiFi `freeDMX_AP_xxxxxx`.
2. **Réglages → Lumières → Ajouter** : créez chaque projecteur (nom, adresse DMX, mode de canaux). L'adresse et le mode doivent correspondre à ceux réglés sur le projecteur lui-même.
3. **Réglages → Connexion → Test de connexion (Blink)** : vos lumières doivent clignoter deux fois.
4. **Éditeur** : choisissez une ambiance, puis une lumière (ou *Toutes les lumières*), puis couleurs / intensité / effets.
5. **Contrôle** : touchez une carte d'ambiance pour la jouer. **Blackout** éteint tout en un appui. Le curseur **Master** limite la luminosité globale.

L'écran reste allumé tant que l'app est ouverte : le téléphone ne se verrouille pas en plein spectacle.

---

## Télécharger et installer l'app Android (APK)

Aucun outil de développement nécessaire :

1. Sur votre téléphone Android, ouvrez la **[dernière release](https://github.com/xam74er1/Mobile-DMX-Improvisation/releases/latest)** sur GitHub.
2. Dans **Assets**, téléchargez le fichier `.apk`.
3. Ouvrez le fichier téléchargé. Si Android le bloque, autorisez **« Installer des applications inconnues »** pour votre navigateur / gestionnaire de fichiers (Paramètres → Applications → Accès spécial → Installer des applications inconnues).
4. Appuyez sur **Installer**, puis ouvrez **DMX Improvisator**.
5. Connectez-vous au WiFi du FreeDMX AP et suivez l'utilisation rapide ci-dessus. Si Android signale que le WiFi n'a pas d'accès internet, choisissez de **rester connecté**.

Tutoriels utiles :
- [Installer des applis hors Play Store (Aide Android)](https://support.google.com/android/answer/12123624)
- [Comment installer un APK sur Android (Android Authority, en anglais)](https://www.androidauthority.com/how-to-install-apks-31494/)
- [Page produit Eurolite FreeDMX AP](https://www.steinigke.de/en/mpn51860200-eurolite-freedmx-ap-wireless-dmx-interface.html)
- [Le protocole Art-Net (Wikipédia)](https://fr.wikipedia.org/wiki/Art-Net)

> iOS n'a pas d'équivalent à l'APK : compilez-le vous-même avec `npx expo run:ios` (voir plus bas).

---

## Prérequis (compilation depuis les sources)

| Outil | Version minimale | Téléchargement |
|------|----------------|---------|
| Node.js | **18.13+** | https://nodejs.org (installeur LTS) |
| npm | 9+ | Inclus avec Node |
| Android Studio | Récent | https://developer.android.com/studio (pour les builds Android) |

> **Important :** Node 16 n'est pas supporté. Installez Node 20 LTS ou plus avant de continuer.

## Installation

```bash
npm install
```

## Lancer — Web (aperçu UI, sans DMX)

```bash
start-web.bat            # Windows
npx expo start --web     # ou en ligne de commande
```

S'ouvre sur `http://localhost:8081`. L'interface est fonctionnelle mais aucun paquet DMX n'est envoyé en UDP.

## Lancer — Android (contrôle DMX complet)

> Nécessite un appareil Android connecté (débogage USB activé) **ou** un émulateur.

```bash
start-android.bat        # Windows
npx expo run:android     # ou en ligne de commande
```

Cela compile un **APK de développement** avec les modules natifs (dont le socket UDP pour Art-Net) et l'installe sur l'appareil.

> **Pourquoi pas Expo Go ?** Le module natif `react-native-udp` n'est pas inclus dans Expo Go. Il faut un build de développement pour avoir une vraie sortie DMX.

---

## Connexion au Eurolite FreeDMX AP

1. Connectez le téléphone au WiFi du boîtier — il crée un hotspot non chiffré nommé `freeDMX_AP_xxxxxx`.
2. Ouvrez l'app → onglet **Réglages**. Les valeurs par défaut (`192.168.4.1`, Transport `UDP (Art-Net)`, port `6454`) correspondent à un boîtier d'usine.
3. Si ça ne marche pas, essayez le transport `FreeDMX Native` (port `10100` par défaut, le protocole propriétaire d'origine ; certains boîtiers n'implémentent que celui-là). Si le champ **General → UDP-Port** du boîtier (`http://192.168.4.1`) a été modifié, le port doit correspondre exactement en FreeDMX Native (le port Art-Net `6454` est fixe).
4. Laissez l'**Univers** à `0`.
5. Appuyez sur **Test de connexion (Blink)** — vos lumières doivent clignoter deux fois.

---

## Guide de l'app

### Panneau 1 — Contrôle (mode show)
- **Blackout** (en haut) — un appui éteint tout ; un second appui rétablit.
- **Master** — plafond de luminosité global.
- **Cartes d'ambiance** — touchez pour activer/désactiver.
- **Appui long sur une carte** — renommer, dupliquer, déplacer, supprimer ou ouvrir dans l'éditeur.

Tout l'état est **sauvegardé automatiquement** et restauré au prochain lancement.

### Panneau 2 — Éditeur
- Choisir une ambiance, puis une lumière (ou « Toutes les lumières »).
- Pastilles de couleurs, roue chromatique, curseurs RGBW/A/UV, intensité.
- Attacher des effets (stroboscope, battement de cœur, rampes, transitions…).

Les changements sont envoyés **en direct** aux lumières.

### Panneau 3 — Réglages
- **Connexion** : IP, port, univers, test, scan réseau, choix du transport.
- **Lumières** : aperçu de scène, ajout/suppression/configuration des projecteurs, configuration en masse, zones.
- **Sauvegarde** : export/import des ambiances, réinitialisation.

---

## Dépannage

| Problème | Solution |
|---------|-----|
| Les lumières ne répondent pas | Vérifiez que le téléphone est sur le WiFi Eurolite, IP `192.168.4.1`. En `UDP (Art-Net)` le port doit être `6454` ; en `FreeDMX Native`, il doit correspondre au réglage UDP-Port du boîtier (défaut `10100`). Vérifiez aussi adresse DMX et mode de canaux sur le projecteur. |
| Le build échoue | Vérifiez Node 18+ : `node --version` |
| Erreur `react-native-udp` sur le web | Normal — l'UDP est désactivé sur le web |
| Le premier build est lent | Normal — Gradle télécharge ses dépendances |
