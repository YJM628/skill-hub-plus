import type { ITranslationProvider } from './ITranslationProvider'
import type { Language, TranslationError } from './types'

interface LocalDictionary {
  [key: string]: {
    [lang in Language]?: string
  }
}

const LOCAL_DICTIONARY: LocalDictionary = {
  'hello': {
    'zh': '你好',
    'ja': 'こんにちは',
    'ko': '안녕하세요',
    'es': 'hola',
    'fr': 'bonjour',
    'de': 'hallo',
    'ru': 'привет',
    'pt': 'olá',
    'it': 'ciao'
  },
  'world': {
    'zh': '世界',
    'ja': '世界',
    'ko': '세계',
    'es': 'mundo',
    'fr': 'monde',
    'de': 'welt',
    'ru': 'мир',
    'pt': 'mundo',
    'it': 'mondo'
  },
  'welcome': {
    'zh': '欢迎',
    'ja': 'ようこそ',
    'ko': '환영합니다',
    'es': 'bienvenido',
    'fr': 'bienvenue',
    'de': 'willkommen',
    'ru': 'добро пожаловать',
    'pt': 'bem-vindo',
    'it': 'benvenuto'
  },
  'thank': {
    'zh': '谢谢',
    'ja': 'ありがとう',
    'ko': '감사합니다',
    'es': 'gracias',
    'fr': 'merci',
    'de': 'danke',
    'ru': 'спасибо',
    'pt': 'obrigado',
    'it': 'grazie'
  },
  'goodbye': {
    'zh': '再见',
    'ja': 'さようなら',
    'ko': '안녕히 가세요',
    'es': 'adiós',
    'fr': 'au revoir',
    'de': 'auf wiedersehen',
    'ru': 'до свидания',
    'pt': 'adeus',
    'it': 'arrivederci'
  },
  'please': {
    'zh': '请',
    'ja': 'お願いします',
    'ko': '제발',
    'es': 'por favor',
    'fr': 's\'il vous plaît',
    'de': 'bitte',
    'ru': 'пожалуйста',
    'pt': 'por favor',
    'it': 'per favore'
  },
  'yes': {
    'zh': '是',
    'ja': 'はい',
    'ko': '예',
    'es': 'sí',
    'fr': 'oui',
    'de': 'ja',
    'ru': 'да',
    'pt': 'sim',
    'it': 'sì'
  },
  'no': {
    'zh': '不',
    'ja': 'いいえ',
    'ko': '아니오',
    'es': 'no',
    'fr': 'non',
    'de': 'nein',
    'ru': 'нет',
    'pt': 'não',
    'it': 'no'
  },
  'error': {
    'zh': '错误',
    'ja': 'エラー',
    'ko': '오류',
    'es': 'error',
    'fr': 'erreur',
    'de': 'fehler',
    'ru': 'ошибка',
    'pt': 'erro',
    'it': 'errore'
  },
  'success': {
    'zh': '成功',
    'ja': '成功',
    'ko': '성공',
    'es': 'éxito',
    'fr': 'succès',
    'de': 'erfolg',
    'ru': 'успех',
    'pt': 'sucesso',
    'it': 'successo'
  },
  'loading': {
    'zh': '加载中',
    'ja': '読み込み中',
    'ko': '로딩 중',
    'es': 'cargando',
    'fr': 'chargement',
    'de': 'laden',
    'ru': 'загрузка',
    'pt': 'carregando',
    'it': 'caricamento'
  },
  'save': {
    'zh': '保存',
    'ja': '保存',
    'ko': '저장',
    'es': 'guardar',
    'fr': 'enregistrer',
    'de': 'speichern',
    'ru': 'сохранить',
    'pt': 'salvar',
    'it': 'salva'
  },
  'cancel': {
    'zh': '取消',
    'ja': 'キャンセル',
    'ko': '취소',
    'es': 'cancelar',
    'fr': 'annuler',
    'de': 'abbrechen',
    'ru': 'отмена',
    'pt': 'cancelar',
    'it': 'annulla'
  },
  'delete': {
    'zh': '删除',
    'ja': '削除',
    'ko': '삭제',
    'es': 'eliminar',
    'fr': 'supprimer',
    'de': 'löschen',
    'ru': 'удалить',
    'pt': 'excluir',
    'it': 'elimina'
  },
  'edit': {
    'zh': '编辑',
    'ja': '編集',
    'ko': '편집',
    'es': 'editar',
    'fr': 'modifier',
    'de': 'bearbeiten',
    'ru': 'редактировать',
    'pt': 'editar',
    'it': 'modifica'
  },
  'search': {
    'zh': '搜索',
    'ja': '検索',
    'ko': '검색',
    'es': 'buscar',
    'fr': 'rechercher',
    'de': 'suchen',
    'ru': 'поиск',
    'pt': 'pesquisar',
    'it': 'cerca'
  },
  'settings': {
    'zh': '设置',
    'ja': '設定',
    'ko': '설정',
    'es': 'configuración',
    'fr': 'paramètres',
    'de': 'einstellungen',
    'ru': 'настройки',
    'pt': 'configurações',
    'it': 'impostazioni'
  },
  'help': {
    'zh': '帮助',
    'ja': 'ヘルプ',
    'ko': '도움말',
    'es': 'ayuda',
    'fr': 'aide',
    'de': 'hilfe',
    'ru': 'помощь',
    'pt': 'ajuda',
    'it': 'aiuto'
  },
  'info': {
    'zh': '信息',
    'ja': '情報',
    'ko': '정보',
    'es': 'información',
    'fr': 'information',
    'de': 'information',
    'ru': 'информация',
    'pt': 'informação',
    'it': 'informazioni'
  },
  'warning': {
    'zh': '警告',
    'ja': '警告',
    'ko': '경고',
    'es': 'advertencia',
    'fr': 'avertissement',
    'de': 'warnung',
    'ru': 'предупреждение',
    'pt': 'aviso',
    'it': 'avviso'
  }
}

export class LocalDictionaryProvider implements ITranslationProvider {
  private dictionary: LocalDictionary

  constructor() {
    this.dictionary = LOCAL_DICTIONARY
  }

  async translate(text: string, targetLang: Language): Promise<string> {
    const normalizedText = text.trim().toLowerCase()
    const words = normalizedText.split(/\s+/)
    
    const translatedWords = words.map(word => {
      const cleanWord = word.replace(/[^\w]/g, '')
      
      if (this.dictionary[cleanWord] && this.dictionary[cleanWord][targetLang]) {
        return this.dictionary[cleanWord][targetLang]!
      }
      
      return word
    })
    
    const result = translatedWords.join(' ')
    
    // Preserve original punctuation
    const punctuationMap: { [key: string]: { [lang in Language]?: string } } = {
      '.': { 'zh': '。', 'ja': '。', 'ko': '.' },
      ',': { 'zh': '，', 'ja': '、', 'ko': ',' },
      '?': { 'zh': '？', 'ja': '？', 'ko': '?' },
      '!': { 'zh': '！', 'ja': '！', 'ko': '!' },
      ':': { 'zh': '：', 'ja': '：', 'ko': ':' },
      ';': { 'zh': '；', 'ja': '；', 'ko': ';' }
    }
    
    let finalResult = result
    for (const [punct, replacements] of Object.entries(punctuationMap)) {
      if (replacements[targetLang]) {
        finalResult = finalResult.replace(new RegExp(`\\${punct}`, 'g'), replacements[targetLang]!)
      }
    }
    
    return finalResult
  }

  setApiKey(_key: string | null): void {
    // Local dictionary doesn't need API key
  }

  getApiKey(): string | null {
    return null
  }

  getProviderName(): string {
    return 'Local Dictionary'
  }
}
