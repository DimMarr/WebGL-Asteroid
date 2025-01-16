# Asteroi2 - WebGL

## Description
Asteroi2 est un jeu de tir spatial développé en JavaScript utilisant WebGL. 
Le joueur contrôle un vaisseau spatial et doit détruire des astéroïdes 
de différentes tailles et couleurs pour marquer des points et survivre le plus longtemps possible.

## Fonctionnalités
- Contrôle du vaisseau avec la souris
- Tir avec la touche `ESPACE`
- Redémarrage du jeu avec la touche `R`

## Types d'astéroïdes
Le jeu comprend plusieurs types d'astéroïdes :

1. **Classic**
    - Couleur : Gris/Blanc/Noir
    - Probabilité d'apparition : 95% (par défaut)
    - Points de vie : 1
    - Score : 10

2. **Bad**
    - Couleur : Rouge foncé
    - Probabilité d'apparition : 3% (par défaut)
    - Points de vie : 3
    - Score : 30

3. **Good**
    - Couleur : Vert clair 
    - Probabilité d'apparition : 0.5% (par défaut)
    - Points de vie : 2
    - Score : 20

4. **Raffale**
    - Couleur : Jaune
    - Probabilité d'apparition : 0.5% (par défaut)
    - Points de vie : 3
    - Score : 0
    - Effet : Permet de tirer rapidement pendant 10 secondes

5. **Heart**
    - Couleur : Vert
    - Probabilité d'apparition : 0.5% (par défaut)
    - Points de vie : 3
    - Score : 0
    - Effet : Ajoute une vie supplémentaire

6. **Ultime**
    - Couleur : Bleu foncé
    - Probabilité d'apparition : 0.5% (par défaut)
    - Points de vie : 5
    - Score : 100
