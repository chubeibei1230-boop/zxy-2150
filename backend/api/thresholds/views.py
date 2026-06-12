from django.http import JsonResponse, HttpRequest
from common.decorators import require_role
from common.utils import success_response, error_response
from repositories import threshold_repository


@require_role(['admin', 'operator', 'auditor', 'user'])
def thresholds_view(request: HttpRequest) -> JsonResponse:
    if request.method == 'GET':
        return JsonResponse(success_response(threshold_repository.get()))

    if request.method == 'PUT':
        if request.user_info.get('role') != 'admin':
            return JsonResponse(error_response('权限不足，无法访问该资源'), status=403)
        body = getattr(request, 'json_body', {})
        required = ['default_visit_days', 'satisfaction_standard', 'max_unreachable_attempts', 'repeat_repair_days']
        for key in required:
            if key not in body:
                return JsonResponse(error_response('阈值配置不完整'), status=400)
        updated = threshold_repository.update({key: int(body[key]) for key in required})
        return JsonResponse(success_response(updated, '保存成功'))

    return JsonResponse(error_response('方法不允许', code=405), status=405)
