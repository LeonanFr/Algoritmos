import asyncio
import aiohttp
import time
from typing import Dict, Any

# CONFIGURAÇÕES
URL = "https://orquestradoralgoritmos-sfjr.onrender.com/api/practice/submit"
HEADERS = {
    "Content-Type": "application/json",
    "Authorization": "Bearer cWcG1T82qiJk"
}

# Código Kotlin para somar dois números
KOTLIN_CODE = """
fun main() {
    // Lê uma linha com dois números separados por espaço
    val (a, b) = readLine()!!.split(' ').map { it.toInt() }
    println(a + b)
}
"""

PAYLOAD = {
    "challengeId": "soma_dois_numeros",
    "language": "kotlin",
    "code": KOTLIN_CODE,
    "type": "test"
}

TOTAL_REQUESTS = 10          # total de requisições
CONCURRENCY = 30             # quantas serão enviadas ao mesmo tempo

# Contadores
success_count = 0
error_count = 0
responses_time: Dict[str, list] = {"total": [], "by_status": {}}

async def send_request(session: aiohttp.ClientSession, request_id: int) -> None:
    global success_count, error_count
    try:
        start = time.perf_counter()
        async with session.post(URL, json=PAYLOAD, headers=HEADERS) as resp:
            elapsed = time.perf_counter() - start
            status = resp.status
            print(f"[{request_id:03d}] Status {status} - {elapsed:.2f}s")
            if 200 <= status < 300:
                success_count += 1
                # Opcional: ler resposta para ver o veredito
                # body = await resp.text()
                # print(f"      -> {body[:100]}")
            else:
                error_count += 1
            responses_time["total"].append(elapsed)
            if status not in responses_time["by_status"]:
                responses_time["by_status"][status] = []
            responses_time["by_status"][status].append(elapsed)
    except Exception as e:
        error_count += 1
        print(f"[{request_id:03d}] ERRO: {str(e)}")

async def main():
    print(f"Iniciando teste de estresse: {TOTAL_REQUESTS} requisições, concorrência={CONCURRENCY}")
    start_global = time.perf_counter()

    semaphore = asyncio.Semaphore(CONCURRENCY)

    async with aiohttp.ClientSession() as session:
        async def limited_send(req_id):
            async with semaphore:
                await send_request(session, req_id)

        tasks = [limited_send(i) for i in range(TOTAL_REQUESTS)]
        await asyncio.gather(*tasks)

    elapsed_global = time.perf_counter() - start_global

    print("\n" + "="*50)
    print(f"Tempo total: {elapsed_global:.2f}s")
    print(f"Requisições bem-sucedidas: {success_count}")
    print(f"Falhas: {error_count}")
    if responses_time["total"]:
        avg_time = sum(responses_time["total"]) / len(responses_time["total"])
        print(f"Tempo médio por requisição: {avg_time:.3f}s")
    print("\nDetalhamento por status HTTP:")
    for status, times in responses_time["by_status"].items():
        print(f"  {status}: {len(times)} ocorrências (média {sum(times)/len(times):.3f}s)")

if __name__ == "__main__":
    asyncio.run(main())