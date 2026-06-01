<script setup lang="ts">
import { ref, computed } from 'vue'
import { Select, Input, Button, Toggle, Textarea } from '@proj-airi/ui/components/form'
import { useI18n } from 'vue-i18n'

interface Outfit {
  id: string
  name: string
  type: 'base' | 'overlay'
  expressions: string[]
  backgroundId: string
  expressionCount: number
}

const props = defineProps<{
  outfits: Outfit[]
  selectedOutfitId?: string
}>()

const emit = defineEmits<{
  (e: 'update:selectedOutfitId', id: string): void
  (e: 'addOutfit'): void
  (e: 'deleteOutfit', id: string): void
}>()

const { t } = useI18n()
const newOutfit = ref({
  name: '',
  type: 'base',
  expressions: [''],
  backgroundId: 'none',
})

const selectedOutfit = computed<Outfit | undefined>({
  get: () => props.outfits.find((outfit) => outfit.id === props.selectedOutfitId),
  set: (outfit) => {
    emit('update:selectedOutfitId', outfit?.id || '')
  },
})

const addNewOutfit = () => {
  emit('addOutfit')
  newOutfit.value = {
    name: '',
    type: 'base',
    expressions: [''],
    backgroundId: 'none',
  }
}

const deleteOutfit = (id: string) => {
  emit('deleteOutfit', id)
}

const updateOutfit = () => {
  if (selectedOutfit.value) {
    const updatedOutfits = props.outfits.map((outfit) =>
      outfit.id === selectedOutfit.value.id ? { ...selectedOutfit.value, ...newOutfit.value } : outfit,
    )
    // Emit updated outfits to parent
    emit('update:outfits', updatedOutfits)
  }
}
</script>

<template>
  <div class="tab-content ml-auto mr-auto w-95%">
    <h2 class="mb-4 text-lg font-medium text-neutral-800 dark:text-neutral-200">
      {{ t('settings.pages.card.creation.outfits') }}
    </h2>

    <div v-if="selectedOutfit" class="mb-6">
      <h3 class="mb-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {{ selectedOutfit.name }} ({{ selectedOutfit.type }})
      </h3>

      <div class="grid grid-cols-1 gap-4">
        <div>
          <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            {{ t('settings.pages.card.creation.outfit.name') }}
          </label>
          <Input v-model="newOutfit.name" class="w-full" />
        </div>

        <div>
          <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            {{ t('settings.pages.card.creation.outfit.type') }}
          </label>
          <Select
            v-model="newOutfit.type"
            :options="[
              { value: 'base', label: t('settings.pages.card.creation.outfit.type.base') },
              { value: 'overlay', label: t('settings.pages.card.creation.outfit.type.overlay') },
            ]"
            class="w-full"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            {{ t('settings.pages.card.creation.outfit.background') }}
          </label>
          <Select
            v-model="newOutfit.backgroundId"
            :options="[{ value: 'none', label: t('settings.pages.card.creation.outfit.background.none') }]"
            class="w-full"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            {{ t('settings.pages.card.creation.outfit.expressions') }}
          </label>
          <div class="flex flex-col gap-2">
            <Input
              v-for="(expression, index) in newOutfit.expressions"
              :key="index"
              v-model="newOutfit.expressions[index]"
              class="w-full"
            />
            <Button @click="newOutfit.expressions.push('')" class="text-sm text-neutral-500 dark:text-neutral-400">
              {{ t('settings.pages.card.creation.add_expression') }}
            </Button>
          </div>
        </div>
      </div>

      <div class="mt-4 flex gap-2">
        <Button @click="updateOutfit" class="bg-primary-600 text-white px-4 py-2 rounded-md">
          {{ t('settings.pages.card.creation.save') }}
        </Button>
        <Button
          @click="deleteOutfit(selectedOutfit.id)"
          class="bg-red-500 text-white px-4 py-2 rounded-md"
          v-if="props.outfits.length > 1"
        >
          {{ t('settings.pages.card.creation.delete') }}
        </Button>
      </div>
    </div>

    <div class="mt-6">
      <h3 class="mb-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {{ t('settings.pages.card.creation.outfits_list') }}
      </h3>

      <div
        v-if="props.outfits.length === 0"
        class="p-4 bg-neutral-50 rounded-md text-sm text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
      >
        {{ t('settings.pages.card.creation.no_outfits') }}
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="outfit in props.outfits"
          :key="outfit.id"
          class="p-3 border border-neutral-200 rounded-md cursor-pointer hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          @click="selectedOutfit = outfit"
        >
          <div class="flex justify-between items-center">
            <div>
              <div class="font-medium text-neutral-800 dark:text-neutral-200">
                {{ outfit.name }} ({{ outfit.type }})
              </div>
              <div class="text-sm text-neutral-500 dark:text-neutral-400">
                {{ t('settings.pages.card.creation.expressions_count', { count: outfit.expressionCount }) }}
              </div>
            </div>
            <div
              v-if="selectedOutfitId === outfit.id"
              class="text-xs bg-primary-100 text-primary-800 px-2 py-1 rounded-full dark:bg-primary-900 dark:text-primary-200"
            >
              {{ t('settings.pages.card.creation.current') }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-6 flex justify-end">
      <Button @click="addNewOutfit" class="bg-primary-600 text-white px-4 py-2 rounded-md">
        {{ t('settings.pages.card.creation.add_outfit') }}
      </Button>
    </div>
  </div>
</template>
