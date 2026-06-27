import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const tokenSchema = z.object({
  token: z.string().min(10, "Token must be at least 10 characters long"),
});

export function TokenForm({ onSave }: { onSave: (token: string) => void }) {
  const form = useForm<z.infer<typeof tokenSchema>>({
    resolver: zodResolver(tokenSchema),
    defaultValues: { token: "" },
  });

  function onSubmit(values: z.infer<typeof tokenSchema>) {
    onSave(values.token);
  }

  return (
    <div className="flex items-center justify-center min-h-[50vh] p-4">
      <Card className="w-full max-w-md border-primary/20 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-xl text-primary">System Authentication</CardTitle>
          <CardDescription>
            Enter your Yandex OAuth token to connect to the smart home API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="token"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Access Token</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="AQAAA..." 
                        type="password" 
                        className="font-mono" 
                        data-testid="input-yandex-token"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" data-testid="button-save-token">
                Connect System
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
