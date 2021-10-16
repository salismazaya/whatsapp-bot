/**
 * Konversi ke bahasa planet by ibnusyawall
 * Example: kamu menjadi kagamugu.
 * pastebin: https://pastebin.com/wzqHwhzh
 **/


const bahasa_planet = (text, alias) => {
    let result = ''
    text.split``.map(v => {
        result += (
            (
                (v == 'a') ? v.replace('a', `a${alias}a`) :
                (v == 'i') ? v.replace('i', `i${alias}i`) :
                (v == 'u') ? v.replace('u', `u${alias}u`) :
                (v == 'e') ? v.replace('e', `e${alias}e`) :
                (v == 'o') ? v.replace('o', `o${alias}o`) :
                v
            )
        )
    })
    return result
}

module.exports = bahasa_planet
