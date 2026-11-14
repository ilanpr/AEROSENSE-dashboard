#pragma once
#include <time.h>
extern long g_epoch;
#define time(x) ((time_t)g_epoch)
