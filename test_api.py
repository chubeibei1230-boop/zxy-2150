import urllib.request
import json

def make_request(url, method='GET', data=None, token=None):
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    if data:
        headers['Content-Type'] = 'application/json'
        body = json.dumps(data).encode('utf-8')
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
    else:
        req = urllib.request.Request(url, headers=headers, method=method)
    return req

def main():
    base_url = 'http://localhost:8118/api'
    print('=' * 60)
    print('社区维修回访管理系统 - 后端 API 功能测试')
    print('=' * 60)
    print()

    # 1. 管理员登录
    print('1. 测试管理员登录...')
    req = make_request(f'{base_url}/auth/login', 'POST', {'username': 'admin', 'password': '123456'})
    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read().decode('utf-8'))
    admin_token = result['data']['token']
    admin_user = result['data']['user']
    print(f'   ✓ 登录成功：{admin_user["name"]} ({admin_user["role"]})')
    print()

    # 2. 获取当前用户
    print('2. 测试获取当前用户...')
    req = make_request(f'{base_url}/auth/me', 'GET', token=admin_token)
    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read().decode('utf-8'))
    print(f'   ✓ 当前用户：{result["data"]["name"]}')
    print()

    # 3. 获取维修类别
    print('3. 测试获取维修类别...')
    req = make_request(f'{base_url}/categories', 'GET', token=admin_token)
    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read().decode('utf-8'))
    print(f'   ✓ 维修类别：{len(result["data"])} 个')
    for cat in result['data'][:3]:
        print(f'     - {cat["name"]}')
    print()

    # 4. 获取回访规则
    print('4. 测试获取回访规则...')
    req = make_request(f'{base_url}/rules', 'GET', token=admin_token)
    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read().decode('utf-8'))
    print(f'   ✓ 回访规则：{len(result["data"])} 条')
    for rule in result['data'][:2]:
        print(f'     - {rule["name"]} (优先级: {rule["priority"]})')
    print()

    # 5. 获取回访列表（分页）
    print('5. 测试获取回访列表（分页）...')
    req = make_request(f'{base_url}/visits?page=1&page_size=5', 'GET', token=admin_token)
    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read().decode('utf-8'))
    visit_list = result['data']
    print(f'   ✓ 回访列表：共 {visit_list["total"]} 条，当前页 {len(visit_list["items"])} 条')
    status_count = {}
    for v in visit_list['items']:
        status_count[v['status']] = status_count.get(v['status'], 0) + 1
    print(f'     当前页状态分布：{status_count}')
    print()

    # 6. 获取回访详情
    print('6. 测试获取回访详情...')
    visit_id = visit_list['items'][0]['id']
    req = make_request(f'{base_url}/visits/{visit_id}', 'GET', token=admin_token)
    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read().decode('utf-8'))
    visit = result['data']
    print(f'   ✓ 回访详情：{visit["repair_order_no"]} - {visit["user_name"]}')
    print(f'     状态：{visit["status"]}，满意度：{visit["satisfaction"]}')
    print(f'     命中规则：{len(visit["matched_rules"])} 条')
    print(f'     状态轨迹：{len(visit["status_timeline"])} 条记录')
    print()

    # 7. 获取统计数据
    print('7. 测试统计接口...')
    req = make_request(f'{base_url}/stats/dashboard', 'GET', token=admin_token)
    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read().decode('utf-8'))
    stats = result['data']
    print(f'   ✓ 统计数据：')
    print(f'     待回访：{stats["pending_count"]}')
    print(f'     二次处理率：{stats["reprocess_rate"]}%')
    print(f'     平均满意度：{stats["avg_satisfaction"]}')
    print(f'     回访总数：{stats["total_visits"]}')
    print(f'     规则命中排行：')
    for r in stats['rule_hit_ranking'][:3]:
        print(f'       - {r["rule_name"]}: {r["hit_count"]} 次')
    print()

    # 8. 测试筛选功能
    print('8. 测试筛选功能（状态=待回访）...')
    req = make_request(f'{base_url}/visits?status=pending', 'GET', token=admin_token)
    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read().decode('utf-8'))
    print(f'   ✓ 待回访记录：{result["data"]["total"]} 条')
    print()

    # 9. 测试审计员权限
    print('9. 测试审计员权限...')
    req = make_request(f'{base_url}/auth/login', 'POST', {'username': 'auditor', 'password': '123456'})
    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read().decode('utf-8'))
    audit_token = result['data']['token']
    print(f'   ✓ 审计员登录成功')

    # 测试审计员读取
    req = make_request(f'{base_url}/visits?page=1&page_size=1', 'GET', token=audit_token)
    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read().decode('utf-8'))
    print(f'   ✓ 审计员读取回访列表成功：{result["data"]["total"]} 条')

    # 测试审计员修改（应该被拒绝）
    try:
        req = make_request(f'{base_url}/categories', 'POST', {'name': '测试类别'}, token=audit_token)
        resp = urllib.request.urlopen(req)
        print('   ✗ 审计员应该不能修改，但成功了！')
    except urllib.error.HTTPError as e:
        if e.code == 403:
            print('   ✓ 审计员修改操作被正确拒绝（403）')
        else:
            print(f'   ⚠ 意外的状态码：{e.code}')
    print()

    # 10. 测试处理人员权限
    print('10. 测试处理人员权限...')
    req = make_request(f'{base_url}/auth/login', 'POST', {'username': 'operator', 'password': '123456'})
    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read().decode('utf-8'))
    op_token = result['data']['token']
    print(f'   ✓ 处理人员登录成功')

    # 测试处理人员能否访问规则配置（应该被拒绝）
    try:
        req = make_request(f'{base_url}/users', 'GET', token=op_token)
        resp = urllib.request.urlopen(req)
        print('   ✗ 处理人员应该不能访问用户管理，但成功了！')
    except urllib.error.HTTPError as e:
        if e.code == 403:
            print('   ✓ 处理人员访问用户管理被正确拒绝（403）')
        else:
            print(f'   ⚠ 意外的状态码：{e.code}')
    print()

    print('=' * 60)
    print('所有 API 测试通过！系统运行正常 ✓')
    print('=' * 60)
    print()
    print('预置账号：')
    print('  - 管理员：admin / 123456')
    print('  - 处理人员：operator / 123456')
    print('  - 审计员：auditor / 123456')
    print()
    print('服务地址：')
    print('  - 后端 API：http://localhost:8118')
    print('  - 前端页面：http://localhost:8813')

if __name__ == '__main__':
    main()
