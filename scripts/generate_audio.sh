
#!/bin/bash
set -euo pipefail

# Generate narration audio files (mp3) on macOS using the built-in `say` command.
#
# Why this exists:
# - Repo uses `assets/audio/*.mp3` and `assets/audio_end/*.mp3` for night flow audio.
# - This script regenerates those files from text prompts.
#
# Requirements (macOS):
# - `say` (built-in)
# - `afconvert` (built-in)
#
# Usage examples:
#   ./scripts/generate_audio.sh --list-voices
#   ./scripts/generate_audio.sh --voice Tingting --speed 175
#   ./scripts/generate_audio.sh --only nightmare
#   ./scripts/generate_audio.sh --dry-run

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_BEGIN_DIR="$ROOT_DIR/assets/audio"
OUT_END_DIR="$ROOT_DIR/assets/audio_end"

VOICE="Tingting"   # Chinese voice name shown in `say -v '?'`
SPEED_WPM="175"    # words-per-minute-ish; `say -r`
ONLY=""            # single key to generate
DRY_RUN="0"

print_usage() {
	cat <<'USAGE'
Generate narration audio mp3 files using macOS `say`.

Options:
	--voice <name>      macOS voice name (default: Tingting)
	--speed <number>    speech rate (default: 175)
	--only <key>        generate only a single entry (e.g. nightmare)
	--dry-run           print what would be generated
	--list-voices       print available `say` voices
	-h, --help          help

USAGE
}

list_voices() {
	say -v '?' | cat
}

while [[ $# -gt 0 ]]; do
	case "$1" in
		--voice)
			VOICE="$2"; shift 2 ;;
		--speed)
			SPEED_WPM="$2"; shift 2 ;;
		--only)
			ONLY="$2"; shift 2 ;;
		--dry-run)
			DRY_RUN="1"; shift 1 ;;
		--list-voices)
			list_voices; exit 0 ;;
		-h|--help)
			print_usage; exit 0 ;;
		*)
			echo "Unknown arg: $1" >&2
			print_usage
			exit 2
			;;
	esac
done

mkdir -p "$OUT_BEGIN_DIR" "$OUT_END_DIR"

tmp_m4a() {
	mktemp -t wwgj_tts_XXXXXX.m4a
}

tts_to_mp3() {
	local text="$1"
	local out_mp3="$2"

	local tmp
	tmp="$(tmp_m4a)"

	if [[ "$DRY_RUN" == "1" ]]; then
		echo "[dry-run] -> $out_mp3 :: $text"
		return 0
	fi

		# Generate speech audio
			say -v "$VOICE" -r "$SPEED_WPM" -o "$tmp" "$text"

		# Convert to mp3 if possible; some macOS builds don't support MP3 encoding via afconvert.
		# If mp3 conversion fails, fall back to m4a (AAC) and warn.
		if afconvert -f MPG3 -d .mp3 "$tmp" "$out_mp3" >/dev/null 2>&1; then
			rm -f "$tmp"
			return 0
		fi

		local out_m4a
		out_m4a="${out_mp3%.mp3}.m4a"
		echo "[warn] MP3 encoding not available via afconvert on this machine; writing m4a instead: $out_m4a" >&2
		afconvert -f m4af -d 'aac ' "$tmp" "$out_m4a" >/dev/null
		rm -f "$tmp"
}

lookup_tsv() {
	# $1=key, $2=tsv
	local key="$1"
	local tsv="$2"
	local line
	# shellcheck disable=SC2162
	while IFS=$'\t' read -r k v; do
		[[ -z "$k" ]] && continue
		if [[ "$k" == "$key" ]]; then
			echo "$v"
			return 0
		fi
	done <<< "$tsv"
	return 1
}

keys_from_tsv() {
	local tsv="$1"
	# print unique keys
	echo "$tsv" | awk -F'\t' 'NF>=1 {print $1}' | sed '/^$/d' | sort -u
}

# Keys should match existing asset naming convention.
# Begin audio: assets/audio/<key>.mp3
# End audio:   assets/audio_end/<key>.mp3

BEGIN_TSV=$'night\t天黑请闭眼。\n'
BEGIN_TSV+=$'night_end\t天亮了，倒数三秒闭眼举手上警，三，二，一。睁眼。\n'
BEGIN_TSV+=$'wolf\t狼人请睁眼，互相确认身份后，请选择要击杀的玩家。\n'
BEGIN_TSV+=$'wolf_queen\t狼后请睁眼。\n'
BEGIN_TSV+=$'dark_wolf_king\t黑狼王请睁眼。\n'
BEGIN_TSV+=$'nightmare\t梦魇请睁眼，请选择要封锁的玩家。\n'
BEGIN_TSV+=$'gargoyle\t石像鬼请睁眼，请选择要查验的玩家。\n'
BEGIN_TSV+=$'wolf_robot\t机械狼请睁眼，请选择要学习的玩家。\n'
BEGIN_TSV+=$'guard\t守卫请睁眼，请选择要守护的玩家。\n'
BEGIN_TSV+=$'witch\t女巫请睁眼。\n'
BEGIN_TSV+=$'hunter\t猎人请睁眼。\n'
BEGIN_TSV+=$'seer\t预言家请睁眼，请选择要查验的玩家。\n'
BEGIN_TSV+=$'magician\t魔术师请睁眼，请选择要交换的两名玩家。\n'
BEGIN_TSV+=$'psychic\t通灵师请睁眼。\n'
BEGIN_TSV+=$'slacker\t懒人请睁眼。\n'
BEGIN_TSV+=$'celebrity\t摄梦人请睁眼，请选择摄梦对象。\n'

END_TSV=$''
END_TSV+=$'wolf\t狼人请闭眼。\n'
END_TSV+=$'wolf_queen\t狼后请闭眼。\n'
END_TSV+=$'dark_wolf_king\t黑狼王请闭眼。\n'
END_TSV+=$'nightmare\t梦魇请闭眼。\n'
END_TSV+=$'gargoyle\t石像鬼请闭眼。\n'
END_TSV+=$'wolf_robot\t机械狼请闭眼。\n'
END_TSV+=$'guard\t守卫请闭眼。\n'
END_TSV+=$'witch\t女巫请闭眼。\n'
END_TSV+=$'hunter\t猎人请闭眼。\n'
END_TSV+=$'seer\t预言家请闭眼。\n'
END_TSV+=$'magician\t魔术师请闭眼。\n'
END_TSV+=$'psychic\t通灵师请闭眼。\n'
END_TSV+=$'slacker\t懒人请闭眼。\n'
END_TSV+=$'celebrity\t摄梦人请闭眼。\n'

generate_one() {
	local key="$1"

	if [[ -n "$ONLY" && "$ONLY" != "$key" ]]; then
		return 0
	fi

		local begin_text end_text
		begin_text="$(lookup_tsv "$key" "$BEGIN_TSV" || true)"
		end_text="$(lookup_tsv "$key" "$END_TSV" || true)"

		if [[ -n "$begin_text" ]]; then
			tts_to_mp3 "$begin_text" "$OUT_BEGIN_DIR/$key.mp3"
		fi
		if [[ -n "$end_text" ]]; then
			tts_to_mp3 "$end_text" "$OUT_END_DIR/$key.mp3"
		fi
}

	uniq_keys=($( (keys_from_tsv "$BEGIN_TSV"; keys_from_tsv "$END_TSV") | sort -u ))

echo "Generating audio into:"
echo "  $OUT_BEGIN_DIR"
echo "  $OUT_END_DIR"
echo "Voice: $VOICE, speed: $SPEED_WPM"
if [[ -n "$ONLY" ]]; then
	echo "Only: $ONLY"
fi

for key in "${uniq_keys[@]}"; do
	generate_one "$key"
done

echo "Done."

