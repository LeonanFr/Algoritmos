import json
import random

def calcular_saida(wpm_values):
    n = len(wpm_values)
    resultados = [0] * n
    max_so_far = 0
    for i in range(n - 1, -1, -1):
        if wpm_values[i] > max_so_far:
            max_so_far = wpm_values[i]
        resultados[i] = max_so_far
    return resultados

def gerar_caso_gigante(n, modo):
    if modo == 'aleatorio':
        wpm_values = [random.randint(1, 1000) for _ in range(n)]
    elif modo == 'crescente':
        wpm_values = sorted([random.randint(1, 1000) for _ in range(n)])
    
    resultados = calcular_saida(wpm_values)
    
    input_str = f"{n}\n" + " ".join(map(str, wpm_values)) + "\n"
    expected_str = " ".join(map(str, resultados)) + "\n"
    
    return {"input": input_str, "expected": expected_str}

with open('meu_problema.json', 'r', encoding='utf-8') as f:
    dados = json.load(f)

dados['test_cases'] = dados['test_cases'][:13]

dados['test_cases'].append(gerar_caso_gigante(50000, 'aleatorio'))
dados['test_cases'].append(gerar_caso_gigante(100000, 'crescente'))

with open('problema_enriquecido.json', 'w', encoding='utf-8') as f:
    json.dump(dados, f, indent=2, ensure_ascii=False)