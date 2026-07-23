# Damage and Healing Formulas

These draft formulas describe how physical damage, spell damage, and healing can
scale with character level, equipped items, and primary stats.

## Physical Attack Damage

```text
Damage = (Base Damage + Weapon Damage) * (1 + (Strength / 10)) * Level Modifier
```

| Term | Meaning |
| --- | --- |
| `Base Damage` | Constant baseline damage for the attack |
| `Weapon Damage` | Damage contributed by the equipped weapon |
| `Strength` | Character stat that increases physical damage |
| `Level Modifier` | Multiplier based on character level |

### Example

| Input | Value |
| --- | --- |
| Base Damage | `10` |
| Weapon Damage | `5` |
| Strength | `8` |
| Hero Level | `4` |

```text
Level Modifier = 1 + (Hero Level / 10)
Level Modifier = 1 + (4 / 10)
Level Modifier = 1.4

Damage = (10 + 5) * (1 + (8 / 10)) * 1.4
Damage = 15 * 1.8 * 1.4
Damage = 37.8
```

## Spell Damage

```text
Damage = (Base Spell Damage + Intelligence Bonus) * Level Modifier
```

| Term | Meaning |
| --- | --- |
| `Base Spell Damage` | Constant baseline damage for the spell |
| `Intelligence Bonus` | Bonus damage from Intelligence |
| `Level Modifier` | Multiplier based on character level |

### Example: Fireball

| Input | Value |
| --- | --- |
| Base Spell Damage | `20` |
| Intelligence Bonus | `Intelligence * 1.5` |
| Hero Intelligence | `12` |
| Hero Level | `4` |

```text
Level Modifier = 1 + (Hero Level / 10)
Level Modifier = 1 + (4 / 10)
Level Modifier = 1.4

Intelligence Bonus = 12 * 1.5
Intelligence Bonus = 18

Damage = (20 + 18) * 1.4
Damage = 53.2
```

## Spell Healing

```text
Healing = (Base Healing + Wisdom Bonus) * Level Modifier
```

| Term | Meaning |
| --- | --- |
| `Base Healing` | Constant baseline healing for the spell |
| `Wisdom Bonus` | Bonus healing from Wisdom |
| `Level Modifier` | Multiplier based on character level |

### Example: Heal

| Input | Value |
| --- | --- |
| Base Healing | `20` |
| Wisdom Bonus | `Wisdom * 1.5` |
| Hero Wisdom | `10` |
| Hero Level | `4` |

```text
Level Modifier = 1 + (Hero Level / 10)
Level Modifier = 1 + (4 / 10)
Level Modifier = 1.4

Wisdom Bonus = 10 * 1.5
Wisdom Bonus = 15

Healing = (20 + 15) * 1.4
Healing = 49
```

## Tuning Notes

- Adjust base values to tune early-game lethality.
- Adjust stat multipliers to tune class identity and equipment dependency.
- Adjust the level modifier to control progression speed between levels 1 and 10.
