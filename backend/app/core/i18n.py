from typing import Callable
import gettext
import os

LOCALES_DIR = os.path.join(os.path.dirname(__file__), "..", "locales")
SUPPORTED_LANGUAGES = ["en", "cs"]
DEFAULT_LANGUAGE = "en"

_translations: dict = {}


def load_translations():
    global _translations
    for lang in SUPPORTED_LANGUAGES:
        try:
            _translations[lang] = gettext.translation(
                "messages",
                localedir=LOCALES_DIR,
                languages=[lang]
            )
        except FileNotFoundError:
            _translations[lang] = gettext.NullTranslations()


def get_translator(language: str = DEFAULT_LANGUAGE) -> Callable[[str], str]:
    if language not in _translations:
        language = DEFAULT_LANGUAGE
    return _translations.get(language, _translations[DEFAULT_LANGUAGE]).gettext


def _(message: str, language: str = DEFAULT_LANGUAGE) -> str:
    return get_translator(language)(message)


load_translations()
